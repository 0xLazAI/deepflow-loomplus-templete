import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "@jest/globals";

const execFile = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const executorPath = path.join(projectRoot, "assets", "root", "skills", "file-reader", "file-reader-executor.mjs");
const tempRoots = [];

describe("file-reader executor", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true, force: true })));
  });

  test("extracts text from code attachments", async () => {
    const tempRoot = await makeTempRoot();
    const filePath = path.join(tempRoot, "example.py");
    await writeFile(filePath, "def hello():\n  return \"world\"\n", "utf8");

    const { stdout } = await runReader(filePath);

    expect(stdout).toContain("type: text");
    expect(stdout).toContain("def hello()");
    expect(stdout).toContain("return \"world\"");
  });

  test("extracts text from docx attachments", async () => {
    const tempRoot = await makeTempRoot();
    const docxPath = path.join(tempRoot, "brief.docx");
    await createZip(docxPath, {
      "word/document.xml": [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
        "<w:body>",
        "<w:p><w:r><w:t>Hello from docx</w:t></w:r></w:p>",
        "<w:p><w:r><w:t>Next paragraph</w:t></w:r></w:p>",
        "</w:body>",
        "</w:document>",
      ].join(""),
    });

    const { stdout } = await runReader(docxPath);

    expect(stdout).toContain("type: docx");
    expect(stdout).toContain("Hello from docx");
    expect(stdout).toContain("Next paragraph");
  });

  test("extracts table text from xlsx attachments", async () => {
    const tempRoot = await makeTempRoot();
    const xlsxPath = path.join(tempRoot, "tasks.xlsx");
    await createZip(xlsxPath, {
      "xl/sharedStrings.xml": [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        "<si><t>Name</t></si>",
        "<si><t>Ada</t></si>",
        "</sst>",
      ].join(""),
      "xl/worksheets/sheet1.xml": [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        "<sheetData>",
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>Score</v></c></row>',
        '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>42</v></c></row>',
        "</sheetData>",
        "</worksheet>",
      ].join(""),
    });

    const { stdout } = await runReader(xlsxPath);

    expect(stdout).toContain("type: xlsx");
    expect(stdout).toContain("Name\tScore");
    expect(stdout).toContain("Ada\t42");
  });
});

async function makeTempRoot() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "deepflow-file-reader-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}

async function runReader(filePath) {
  return execFile("node", [executorPath, "--path", filePath, "--max-chars", "4000"], {
    maxBuffer: 1024 * 1024,
  });
}

async function createZip(zipPath, files) {
  const root = path.join(path.dirname(zipPath), `${path.basename(zipPath)}-contents`);
  await mkdir(root, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }
  await execFile("zip", ["-qr", zipPath, "."], { cwd: root });
}
