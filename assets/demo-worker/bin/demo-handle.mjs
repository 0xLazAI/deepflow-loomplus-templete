#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import process from "node:process";

const DOCS_MANAGER_EXECUTOR = `${process.env.HOME || "~"}/.openclaw/skills/docs-manager/docs-manager-executor.mjs`;

async function main() {
  const [projectId, bindingId, relativeFilePath] = process.argv.slice(2);

  if (!projectId || !bindingId || !relativeFilePath) {
    fail("usage: node ./bin/demo-handle.mjs <projectId> <bindingId> <relativeFilePath>");
  }

  if (relativeFilePath !== "demo_handoff.md") {
    fail(`unsupported handoff path: ${relativeFilePath}`);
  }

  const handoffPath = await locateDoc(bindingId, relativeFilePath);
  const handoffContent = await fs.readFile(handoffPath, "utf8");
  const summary = summarizeHandoff(handoffContent);
  const receiptContent = [
    "status: done",
    "summary: demo worker done",
    `handoff_summary: ${summary}`,
    "next_step: no further action needed",
  ].join("\n");

  await runDocsManager([
    "--action",
    "write",
    "--binding-id",
    bindingId,
    "--path",
    "demo_receipt.md",
    "--content",
    receiptContent,
  ]);

  process.stdout.write("[demo-worker]:✅ HANDLED\n");
}

async function locateDoc(bindingId, relativeFilePath) {
  const result = await runDocsManager([
    "--action",
    "locate",
    "--binding-id",
    bindingId,
    "--path",
    relativeFilePath,
  ]);

  const line = result.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("✅ "));

  if (!line) {
    throw new Error(`locate did not return a file path for ${relativeFilePath}`);
  }

  return line.slice(2).trim();
}

function summarizeHandoff(content) {
  const compact = String(content || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) {
    return "no handoff content";
  }
  return compact.slice(0, 160);
}

async function runDocsManager(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [DOCS_MANAGER_EXECUTOR, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || stdout || `docs-manager exited with code ${code}`));
    });
  });
}

function fail(message) {
  process.stderr.write(`[demo-worker]:❌ ${message}\n`);
  process.exit(1);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
