import "./helpers/load-test-env.mjs";

import { beforeAll, beforeEach, afterAll, describe, test, expect } from "@jest/globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createTelegramApiMockAdminClient } from "telegram-api-mock-server";
import { includesIgnoreCase } from "./helpers/assertions.mjs";
import { randomPort, sleep, terminateProcess, waitForHttpOk } from "./helpers/http-process.mjs";
import {
  ensureTelegramMockAvailable,
  resolveBotUsername,
  sendTelegramCommand,
  waitForSendMessageContaining,
  withMention,
} from "./helpers/telegram-mock.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");
const docsRoot = "/tmp/deepflow-assets/docs";

const state = {
  adminClient: null,
  pmBotToken: "",
  pmBotMention: "",
  deploymentNotifyBotToken: "",
  deploymentNotifyChatId: 0,
  telegramChatId: 0,
  telegramUserId: 0,
  allowedOrigin: "",
  webPort: 0,
  child: null,
  logs: "",
};

let currentTestStartedAt = 0;
let currentTestLogCursor = 0;
let testChatCounter = 0;

function assertNoDocsManagerShellCommandError(logs) {
  if (!logs.includes("docs-manager: command not found")) {
    return;
  }

  throw new Error(
    [
      "Detected invalid shell invocation: 'docs-manager ...'",
      "docs-manager is a skill, not an executable command.",
      "Use: node ~/.openclaw/skills/docs-manager/docs-manager-executor.mjs --action <action> --binding-id <bindingId> ...",
    ].join("\n"),
  );
}

describe("system integration via telegram mock", () => {
  beforeAll(async () => {
    expect(process.env.OPENAI_API_KEY).toBeTruthy();
    expect(process.env.COORDINATOR_TELEGRAM_BOT_KEY).toBeTruthy();

    const adminBaseUrl = process.env.TELEGRAM_API_MOCK_ADMIN_BASE_URL ?? "http://127.0.0.1:19091";
    const adminToken = process.env.TELEGRAM_API_MOCK_ADMIN_TOKEN;

    state.pmBotToken = String(process.env.COORDINATOR_TELEGRAM_BOT_KEY);
    state.deploymentNotifyBotToken = process.env.TELEGRAM_NOTIFY_BOT_TOKEN ?? state.pmBotToken;
    state.deploymentNotifyChatId = Number.parseInt(process.env.TELEGRAM_NOTIFY_CHAT_ID ?? "-1001234567890", 10);
    state.telegramChatId = state.deploymentNotifyChatId;
    state.telegramUserId = Number.parseInt(process.env.TELEGRAM_TEST_USER_ID ?? "10001", 10);
    state.allowedOrigin = String(process.env.ALLOWED_ORIGIN);

    if (!Number.isFinite(state.deploymentNotifyChatId)) {
      throw new Error("TELEGRAM_NOTIFY_CHAT_ID must be a number");
    }
    if (!Number.isFinite(state.telegramUserId)) {
      throw new Error("TELEGRAM_TEST_USER_ID must be a number");
    }

    state.adminClient = createTelegramApiMockAdminClient({
      baseUrl: adminBaseUrl,
      adminToken,
    });

    await ensureTelegramMockAvailable({ adminClient: state.adminClient, adminBaseUrl });
    const pmBotUsername = await resolveBotUsername(state.pmBotToken);
    state.pmBotMention = `@${pmBotUsername}`;

    await state.adminClient.reset({ token: state.pmBotToken, updates: true, outbound: true });
    if (state.deploymentNotifyBotToken !== state.pmBotToken) {
      await state.adminClient.reset({ token: state.deploymentNotifyBotToken, updates: true, outbound: true });
    }

    await rm(docsRoot, { recursive: true, force: true });
    await mkdir(docsRoot, { recursive: true });

    state.webPort = randomPort();
    const deploymentNotifyText = `integration-notify-${Date.now()}`;

    console.log(`[system-it] spawning server on port ${state.webPort}`);
    state.child = spawn("node", ["dist/server.js"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        WEB_PORT: String(state.webPort),
        DEPLOYMENT_NOTIFY_INTERVAL_SECONDS: "1",
        DEPLOYMENT_NOTIFY_MAX_ATTEMPTS: "60",
        DEPLOYMENT_NOTIFY_TEXT: deploymentNotifyText,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    state.logs = "";
    state.child.stdout.on("data", (chunk) => {
      state.logs += chunk.toString();
    });
    state.child.stderr.on("data", (chunk) => {
      state.logs += chunk.toString();
    });

    console.log("[system-it] waiting for /healthz");
    await waitForHttpOk(`http://127.0.0.1:${state.webPort}/healthz`, 120000);

    console.log("[system-it] waiting for deployment notify telegram message");
    const deploymentNotifyReply = await waitForSendMessageContaining({
      adminClient: state.adminClient,
      botToken: state.deploymentNotifyBotToken,
      chatId: state.deploymentNotifyChatId,
      expectedTextFragment: deploymentNotifyText,
      timeoutMs: 120000,
    });
    expect(includesIgnoreCase(deploymentNotifyReply, deploymentNotifyText)).toBe(true);

    console.log("[system-it] sending warmup telegram message");
    const hiReply = await sendTelegramCommand({
      adminClient: state.adminClient,
      botToken: state.pmBotToken,
      chatId: state.telegramChatId,
      userId: state.telegramUserId,
      text: withMention(state.pmBotMention, "who are you?"),
    });
    expect(hiReply && hiReply.trim().length > 0).toBe(true);
  }, 240000);

  beforeEach(async () => {
    currentTestStartedAt = Date.now();
    currentTestLogCursor = state.logs.length;
    testChatCounter += 1;
    state.telegramChatId = -1234000 - testChatCounter;
    const currentTestName = expect.getState().currentTestName ?? "unknown test";
    console.log(`[it:start] ${currentTestName} chatId=${state.telegramChatId}`);

    await rm(docsRoot, { recursive: true, force: true });
    await mkdir(docsRoot, { recursive: true });
    if (state.adminClient) {
      await state.adminClient.reset({ token: state.pmBotToken, outbound: true, updates: false });
    }
  });

  afterEach(async () => {
    const currentTestName = expect.getState().currentTestName ?? "unknown test";
    const elapsedMs = Math.max(0, Date.now() - currentTestStartedAt);
    const newLogs = state.logs.slice(currentTestLogCursor);
    assertNoDocsManagerShellCommandError(newLogs);
    console.log(`[it:end] ${currentTestName} (${elapsedMs}ms)`);
    await sleep(5000);
  }, 15000);

  afterAll(async () => {
    if (state.child) {
      await terminateProcess(state.child);
    }
    console.log(`[system-it] server logs:\n${state.logs}`);
  });

  test("coordinator to demo-worker to coordinator demo flow works end-to-end", async () => {
    const projectCode = `itproj-demo-${Date.now()}`;
    const handoffAbsolutePath = path.join(docsRoot, "projects", projectCode, "demo_handoff.md");
    const receiptAbsolutePath = path.join(docsRoot, "projects", projectCode, "demo_receipt.md");

    const bindReply = await sendTelegramCommand({
      adminClient: state.adminClient,
      botToken: state.pmBotToken,
      chatId: state.telegramChatId,
      userId: state.telegramUserId,
      text: withMention(state.pmBotMention, `/bind ${projectCode}`),
      expectedContains: projectCode,
    });
    expect(includesIgnoreCase(bindReply, "✅")).toBe(true);

    const writeHandoffReply = await sendTelegramCommand({
      adminClient: state.adminClient,
      botToken: state.pmBotToken,
      chatId: state.telegramChatId,
      userId: state.telegramUserId,
      text: withMention(state.pmBotMention, "/write demo_handoff.md please finish the demo task"),
      expectedContains: "demo_handoff.md",
    });
    expect(includesIgnoreCase(writeHandoffReply, "✅")).toBe(true);
    expect(includesIgnoreCase(writeHandoffReply, "QUEUED")).toBe(true);

    await waitForLogContaining("[demo-worker]:✅ HANDLED", 120000);
    await waitForFile(receiptAbsolutePath, 10000);

    const handoffContent = await readFile(handoffAbsolutePath, "utf8");
    expect(includesIgnoreCase(handoffContent, "demo task")).toBe(true);

    const receiptContent = await readFile(receiptAbsolutePath, "utf8");
    expect(receiptContent.trim().length).toBeGreaterThan(0);
  }, 120000);
});

async function waitForFile(filePath, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await readFile(filePath, "utf8");
      return;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error(`Timed out waiting for file: ${filePath}`);
}

async function waitForLogContaining(fragment, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (state.logs.includes(fragment)) {
      return;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for server log fragment: ${fragment}`);
}
