import { beforeEach, describe, expect, test } from "@jest/globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");
const runtimeRoot = "/tmp/deepflow-assets/runtime/agent-messenger";
const executorPath = path.join(projectRoot, "assets", "root", "skills", "agent-messenger", "agent-messenger-executor.mjs");

describe("agent-messenger", () => {
  beforeEach(async () => {
    await rm(runtimeRoot, { recursive: true, force: true });
  });

  test("enqueue_agent writes explicit agent message into queue", async () => {
    const result = await runMessenger([
      "--action", "enqueue_agent",
      "--agent-id", "demo-worker",
      "--session-id", "handoff-demo123-demo-worker",
      "--message", "/handle demo123 tg:-10001 demo_handoff.md",
      "--binding-id", "tg:-10001",
      "--project-id", "demo123",
      "--path", "demo_handoff.md",
    ], {
      env: {
        AGENT_MESSENGER_DISABLE_DRAIN: "1",
      },
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("✅ QUEUED");

    const files = await readdir(path.join(runtimeRoot, "queue", "pending"));
    expect(files).toHaveLength(1);

    const payload = JSON.parse(await readFile(path.join(runtimeRoot, "queue", "pending", files[0]), "utf8"));
    expect(payload.agentId).toBe("demo-worker");
    expect(payload.message).toBe("/handle demo123 tg:-10001 demo_handoff.md");
    expect(payload.sessionId).toBe("handoff-demo123-demo-worker");
  });

  test("send_binding_message rejects non-telegram binding ids", async () => {
    const result = await runMessenger([
      "--action", "send_binding_message",
      "--binding-id", "http:demo-1",
      "--account-id", "coordinator",
      "--message", "hello",
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("send_binding_message requires Telegram bindingId");
  });

  test("drain sends queued messages through openclaw", async () => {
    const fakeBinRoot = await mkdtemp(path.join(tmpdir(), "agent-messenger-bin-"));
    const fakeOpenclaw = path.join(fakeBinRoot, "openclaw");
    const logPath = path.join(fakeBinRoot, "openclaw.log");
    await writeFile(
      fakeOpenclaw,
      `#!/usr/bin/env sh\nprintf '%s\n' "$*" >> "${logPath}"\nexit 0\n`,
      "utf8",
    );
    await chmod(fakeOpenclaw, 0o755);

    await runMessenger([
      "--action", "enqueue_agent",
      "--agent-id", "coordinator",
      "--session-id", "handoff-demo123-coordinator",
      "--message", "/handle demo123 tg:-10001 demo_receipt.md",
      "--binding-id", "tg:-10001",
      "--project-id", "demo123",
      "--path", "demo_receipt.md",
    ], {
      env: {
        AGENT_MESSENGER_DISABLE_DRAIN: "1",
      },
    });

    const drain = await runMessenger(["--action", "drain"], {
      env: {
        PATH: `${fakeBinRoot}:${process.env.PATH ?? ""}`,
      },
    });

    expect(drain.code).toBe(0);
    const log = await readFile(logPath, "utf8");
    expect(log).toContain("agent --agent coordinator --message /handle demo123 tg:-10001 demo_receipt.md --session-id handoff-demo123-coordinator");

    const pendingFiles = await readdir(path.join(runtimeRoot, "queue", "pending"));
    expect(pendingFiles).toHaveLength(0);

    await rm(fakeBinRoot, { recursive: true, force: true });
  });
});

function runMessenger(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [executorPath, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}
