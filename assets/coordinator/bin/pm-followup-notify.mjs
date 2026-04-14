#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.bindingId.startsWith("tg:")) {
    process.stdout.write("SKIP_UNSUPPORTED_BINDING\n");
    return;
  }
  const reason = args.reason === "receipt_timeout" ? "receipt_timeout" : "followup_gap";
  await runNotifyOwnerCommand(args.projectId, args.bindingId, reason);

  process.stdout.write("SENT\n");
}

function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    map.set(argv[i], argv[i + 1]);
  }

  const required = ["--project-id", "--binding-id", "--project-status-path"];
  for (const key of required) {
    if (!map.get(key)) {
      throw new Error(`missing required arg: ${key}`);
    }
  }

  return {
    projectId: map.get("--project-id"),
    bindingId: map.get("--binding-id"),
    reason: map.get("--reason") ?? "visibility_gap",
    waitingRoles: (map.get("--waiting-roles") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
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
