#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import process from "node:process";
import { shouldNotifyOwner } from "../lib/pm-owner-notify-core.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const afterStatus = await fs.readFile(args.projectStatusPath, "utf8");
  const beforeStatus = decodeBase64(args.beforeStatusBase64);
  const afterSource = args.sourcePath ? await fs.readFile(args.sourcePath, "utf8") : "";
  const beforeSource = decodeBase64(args.beforeSourceBase64);

  const result = shouldNotifyOwner({
    actionType: args.actionType,
    beforeStatus,
    afterStatus,
    beforeSource,
    afterSource,
  });

  if (!result.shouldNotify) {
    process.stdout.write("SKIP\n");
    return;
  }

  if (!args.bindingId.startsWith("tg:")) {
    process.stdout.write("SKIP_UNSUPPORTED_BINDING\n");
    return;
  }

  const reason = args.actionType === "demo_updated" ? "demo_updated" : "status_changed";
  await runNotifyOwnerCommand(args.projectId, args.bindingId, reason);

  process.stdout.write("SENT\n");
}

function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    map.set(argv[i], argv[i + 1]);
  }

  const required = ["--project-id", "--binding-id", "--action-type", "--project-status-path", "--before-status-base64"];
  for (const key of required) {
    if (!map.get(key)) {
      throw new Error(`missing required arg: ${key}`);
    }
  }

  return {
    projectId: map.get("--project-id"),
    bindingId: map.get("--binding-id"),
    actionType: map.get("--action-type"),
    projectStatusPath: map.get("--project-status-path"),
    beforeStatusBase64: map.get("--before-status-base64"),
    sourcePath: map.get("--source-path") ?? "",
    beforeSourceBase64: map.get("--before-source-base64") ?? "",
  };
}

function decodeBase64(value) {
  if (!value) {
    return "";
  }
  return Buffer.from(value, "base64").toString("utf8");
}

async function runNotifyOwnerCommand(projectId, bindingId, reason) {
  const sessionId = buildPmSessionId(projectId);
  const message = `/notify-owner ${projectId} ${bindingId} ${reason}`;
  await new Promise((resolve, reject) => {
    const child = spawn(
      "openclaw",
      ["agent", "--agent", "coordinator", "--message", message, "--session-id", sessionId],
      { stdio: "inherit", env: process.env },
    );

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`openclaw exited with code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
    child.on("error", reject);
  });
}

function buildPmSessionId(projectId) {
  const safeProject = String(projectId || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "") || "unknown";
  return `handoff-${safeProject}-coordinator`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
