#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const defaultMaxBytes = 25 * 1024 * 1024;
const defaultMaxChars = 120000;
const unzipMaxBuffer = 8 * 1024 * 1024;
const unzipTimeoutMs = 10000;

const textExtensions = new Set([
  ".bash",
  ".c",
  ".cfg",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".cxx",
  ".env",
  ".go",
  ".h",
  ".hpp",
  ".htm",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".log",
  ".md",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".swift",
  ".toml",
  ".ts",
  ".tsv",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);

main().catch((error) => fail(error.message));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("usage: node file-reader-executor.mjs --path <absolute-media-path> [--max-bytes <bytes>] [--max-chars <chars>]\n");
    return;
  }
  if (!args.path) {
    fail("missing --path");
  }

  const filePath = path.resolve(args.path);
  const maxBytes = positiveInteger(args.maxBytes, defaultMaxBytes);
  const maxChars = positiveInteger(args.maxChars, defaultMaxChars);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) {
    fail(`file not found: ${filePath}`);
  }
  if (stat.size > maxBytes) {
    fail(`file too large: ${stat.size} bytes exceeds ${maxBytes} byte limit`);
  }

  const ext = path.extname(filePath).toLowerCase();
  let result;
  if (ext === ".docx") {
    result = await readDocx(filePath);
  } else if (ext === ".xlsx") {
    result = await readXlsx(filePath);
  } else if (ext === ".pptx") {
    result = await readPptx(filePath);
  } else if (ext === ".rtf") {
    result = await readRtf(filePath);
  } else if (ext === ".zip") {
    result = await listZip(filePath);
  } else if (ext === ".pdf") {
    result = {
      type: "pdf",
      text: "PDF detected. Use OpenClaw's built-in pdf tool with this MediaPath to read the file content.",
    };
  } else {
    result = await readTextLike(filePath, ext);
  }

  const output = formatOutput({
    path: filePath,
    size: stat.size,
    type: result.type,
    text: truncate(result.text, maxChars),
    truncated: result.text.length > maxChars,
  });
  process.stdout.write(output);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--path") {
      args.path = argv[++index];
      continue;
    }
    if (arg === "--max-bytes") {
      args.maxBytes = argv[++index];
      continue;
    }
    if (arg === "--max-chars") {
      args.maxChars = argv[++index];
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  return args;
}

function positiveInteger(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`expected positive integer, got: ${value}`);
  }
  return parsed;
}

async function readTextLike(filePath, ext) {
  const buffer = await fs.readFile(filePath);
  if (!textExtensions.has(ext) && !looksLikeText(buffer)) {
    return {
      type: "unsupported",
      text: "Unsupported binary or unknown file type. Ask for a PDF/text export, accessible link, split file, or shared-storage upload.",
    };
  }
  return {
    type: "text",
    text: decodeText(buffer),
  };
}

async function readRtf(filePath) {
  const raw = decodeText(await fs.readFile(filePath));
  const text = raw
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    type: "rtf",
    text,
  };
}

async function readDocx(filePath) {
  const documentXml = await unzipText(filePath, "word/document.xml");
  const paragraphs = matchAll(documentXml, /<w:p\b[\s\S]*?<\/w:p>/g)
    .map((paragraph) => extractXmlText(paragraph))
    .filter(Boolean);
  const text = paragraphs.length > 0 ? paragraphs.join("\n") : extractXmlText(documentXml);
  return {
    type: "docx",
    text,
  };
}

async function readXlsx(filePath) {
  const entries = await listZipEntries(filePath);
  const sharedStrings = await readSharedStrings(filePath, entries);
  const sheetEntries = entries
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/u.test(entry))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (sheetEntries.length === 0) {
    fail("xlsx has no worksheet XML entries");
  }

  const sections = [];
  for (const sheetEntry of sheetEntries.slice(0, 20)) {
    const xml = await unzipText(filePath, sheetEntry);
    const rows = matchAll(xml, /<row\b[\s\S]*?<\/row>/g)
      .map((row) => parseXlsxRow(row, sharedStrings))
      .filter((row) => row.some(Boolean))
      .map((row) => row.join("\t"));
    if (rows.length > 0) {
      sections.push(`${sheetEntry}:\n${rows.join("\n")}`);
    }
  }

  return {
    type: "xlsx",
    text: sections.join("\n\n").trim(),
  };
}

async function readPptx(filePath) {
  const entries = await listZipEntries(filePath);
  const slideEntries = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/u.test(entry))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (slideEntries.length === 0) {
    fail("pptx has no slide XML entries");
  }

  const sections = [];
  for (const [index, slideEntry] of slideEntries.slice(0, 80).entries()) {
    const xml = await unzipText(filePath, slideEntry);
    const text = extractXmlText(xml);
    if (text) {
      sections.push(`Slide ${index + 1}:\n${text}`);
    }
  }

  return {
    type: "pptx",
    text: sections.join("\n\n").trim(),
  };
}

async function listZip(filePath) {
  const entries = await listZipEntries(filePath);
  const visibleEntries = entries.slice(0, 200);
  const suffix = entries.length > visibleEntries.length ? `\n... ${entries.length - visibleEntries.length} more entries` : "";
  return {
    type: "zip",
    text: `ZIP archive entries:\n${visibleEntries.join("\n")}${suffix}`,
  };
}

async function readSharedStrings(filePath, entries) {
  if (!entries.includes("xl/sharedStrings.xml")) {
    return [];
  }
  const xml = await unzipText(filePath, "xl/sharedStrings.xml");
  return matchAll(xml, /<si\b[\s\S]*?<\/si>/g).map((entry) => extractXmlText(entry));
}

function parseXlsxRow(rowXml, sharedStrings) {
  return matchAll(rowXml, /<c\b[\s\S]*?<\/c>/g).map((cellXml) => {
    const type = cellXml.match(/\bt="([^"]+)"/u)?.[1];
    if (type === "inlineStr") {
      return extractXmlText(cellXml);
    }
    const rawValue = cellXml.match(/<v>([\s\S]*?)<\/v>/u)?.[1]?.trim() ?? "";
    if (type === "s") {
      const index = Number.parseInt(rawValue, 10);
      return sharedStrings[index] ?? rawValue;
    }
    return decodeXml(rawValue);
  });
}

async function unzipText(filePath, entry) {
  const { stdout } = await execFile("unzip", ["-p", filePath, entry], {
    encoding: "utf8",
    maxBuffer: unzipMaxBuffer,
    timeout: unzipTimeoutMs,
  });
  if (!stdout) {
    fail(`could not read ${entry} from ${filePath}`);
  }
  return stdout;
}

async function listZipEntries(filePath) {
  const { stdout } = await execFile("unzip", ["-Z1", filePath], {
    encoding: "utf8",
    maxBuffer: unzipMaxBuffer,
    timeout: unzipTimeoutMs,
  });
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractXmlText(xml) {
  const normalized = xml
    .replace(/<w:tab\s*\/>/gu, "\t")
    .replace(/<(?:w:br|a:br)\b[^>]*\/>/gu, "\n");
  const runs = matchAll(normalized, /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)
    .map((match) => decodeXml(match.match(/>([\s\S]*?)</u)?.[1] ?? ""))
    .map((text) => text.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  if (runs.length > 0) {
    return runs.join(" ").trim();
  }
  return decodeXml(normalized.replace(/<[^>]+>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeXml(value) {
  return value
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, "\"")
    .replace(/&apos;/gu, "'");
}

function matchAll(value, pattern) {
  return Array.from(value.matchAll(pattern), (match) => match[0]);
}

function decodeText(buffer) {
  if (buffer.length >= 2 && buffer[0] === 255 && buffer[1] === 254) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  }
  if (buffer.length >= 2 && buffer[0] === 254 && buffer[1] === 255) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1];
      swapped[index - 1] = buffer[index];
    }
    return new TextDecoder("utf-16le").decode(swapped);
  }
  return new TextDecoder("utf-8").decode(buffer);
}

function looksLikeText(buffer) {
  if (buffer.length === 0) {
    return true;
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || byte >= 32) {
      printable += 1;
    }
  }
  return printable / sample.length > 0.9;
}

function truncate(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n[Truncated at ${maxChars} characters]`;
}

function formatOutput(result) {
  return [
    `file: ${result.path}`,
    `type: ${result.type}`,
    `sizeBytes: ${result.size}`,
    `truncated: ${result.truncated ? "true" : "false"}`,
    "",
    result.text.trim() || "[No extractable text]",
    "",
  ].join("\n");
}

function fail(message) {
  process.stderr.write(`[file-reader] ${message}\n`);
  process.exit(1);
}
