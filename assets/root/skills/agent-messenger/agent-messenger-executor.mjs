#!/usr/bin/env node

import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RUNTIME_ROOT = "/tmp/deepflow-assets/runtime/agent-messenger";
const QUEUE_ROOT = path.join(RUNTIME_ROOT, "queue");
const QUEUE_PENDING_DIR = path.join(QUEUE_ROOT, "pending");
const QUEUE_DEAD_DIR = path.join(QUEUE_ROOT, "dead");
const WORKER_LOCK_FILE = path.join(QUEUE_ROOT, "worker.lock");
const EXECUTOR_FILE_PATH = fileURLToPath(import.meta.url);
const MAX_RETRIES = readPositiveIntEnv("AGENT_MESSENGER_MAX_RETRIES", 3);
const BASE_BACKOFF_MS = readPositiveIntEnv("AGENT_MESSENGER_BASE_BACKOFF_MS", 5000);
const MAX_BACKOFF_MS = readPositiveIntEnv("AGENT_MESSENGER_MAX_BACKOFF_MS", 120000);

const USAGE = "usage: node agent-messenger-executor.mjs --action <enqueue_agent|drain|send_agent|send_binding_message> [--binding-id <bindingId>|--project-id <projectId>|--path <relativePath>|--agent-id <agentId>|--session-id <sessionId>|--account-id <accountId>|--message <text>]";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureStore();

  switch (args.action) {
    case "enqueue_agent":
      await enqueueAgent(args);
      break;
    case "drain":
      await drainQueue();
      break;
    case "send_agent":
      await sendAgentMessage(args);
      break;
    case "send_binding_message":
      await sendBindingMessage(args);
      break;
    default:
      fail(USAGE);
  }
}

function parseArgs(argv) {
  const parsed = {
    action: "",
    bindingId: "",
    projectId: "",
    relativePath: "",
    agentId: "",
    sessionId: "",
    accountId: "",
    message: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--action":
        parsed.action = requireValue(token, argv[++i]);
        break;
      case "--binding-id":
        parsed.bindingId = requireValue(token, argv[++i]);
        break;
      case "--project-id":
        parsed.projectId = requireValue(token, argv[++i]);
        break;
      case "--path":
        parsed.relativePath = requireValue(token, argv[++i]);
        break;
      case "--agent-id":
        parsed.agentId = requireValue(token, argv[++i]);
        break;
      case "--session-id":
        parsed.sessionId = requireValue(token, argv[++i]);
        break;
      case "--account-id":
        parsed.accountId = requireValue(token, argv[++i]);
        break;
      case "--message":
        parsed.message = requireValue(token, argv[++i]);
        break;
      default:
        fail(`unknown argument: ${token}`);
    }
  }

  if (!parsed.action) {
    fail("--action is required");
  }
  if (argv.length === 0) {
    fail(USAGE);
  }
  return parsed;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) {
    fail(`${flag} requires a value`);
  }
  return value;
}

async function ensureStore() {
  await fs.mkdir(QUEUE_PENDING_DIR, { recursive: true });
  await fs.mkdir(QUEUE_DEAD_DIR, { recursive: true });
}

function fail(message) {
  process.stderr.write(`❌ ${message}\n`);
  process.exit(1);
}

function validateBindingId(bindingId) {
  if (!bindingId) {
    fail("bindingId is required");
  }
  if (!/^tg:-?[0-9]+$|^http:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(bindingId)) {
    fail("bindingId must be tg:<chatId> (supports negative Telegram IDs) or http:<conversationId>");
  }
}

function validateProjectId(projectId) {
  if (!projectId) {
    fail("projectId is required");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(projectId)) {
    fail("projectId may contain only letters, numbers, dot, underscore, or dash");
  }
}

async function enqueueAgent(args) {
  if (!args.agentId) {
    fail("--agent-id is required for enqueue_agent");
  }
  if (!args.sessionId) {
    fail("--session-id is required for enqueue_agent");
  }
  if (!args.message) {
    fail("--message is required for enqueue_agent");
  }

  if (args.bindingId) {
    validateBindingId(args.bindingId);
  }
  if (args.projectId) {
    validateProjectId(args.projectId);
  }

  process.stdout.write(`[agent-messenger] queueing agent=${args.agentId} session=${args.sessionId}\n`);
  if (args.message) {
    process.stdout.write(`[agent-messenger] queue message=${args.message}\n`);
  }
  const task = await enqueueTask({
    bindingId: args.bindingId,
    projectId: args.projectId,
    relativePath: args.relativePath,
    agentId: args.agentId,
    sessionId: args.sessionId,
    message: args.message,
  });
  process.stdout.write(`[agent-messenger] notify queued id=${task.id} attempts=0/${MAX_RETRIES}\n`);
  triggerDrainWorker();
  process.stdout.write(`✅ QUEUED ${task.id}\n`);
}

function triggerDrainWorker() {
  if (process.env.AGENT_MESSENGER_DISABLE_DRAIN === "1") {
    return;
  }
  const child = spawn(process.execPath, [EXECUTOR_FILE_PATH, "--action", "drain"], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
    },
  });
  child.unref();
}

async function enqueueTask({ bindingId, projectId, relativePath, agentId, sessionId, message }) {
  const nowIso = new Date().toISOString();
  const id = `${Date.now()}-${crypto.randomUUID()}`;
  const payload = {
    id,
    bindingId,
    projectId,
    relativePath,
    agentId,
    sessionId,
    message,
    attempts: 0,
    nextAttemptAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastError: "",
  };
  const filePath = path.join(QUEUE_PENDING_DIR, `${id}.json`);
  await writeAtomic(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function drainQueue() {
  const lock = await tryAcquireWorkerLock();
  if (!lock.acquired) {
    return;
  }

  try {
    await processQueueLoop();
  } finally {
    await releaseWorkerLock(lock);
  }
}

async function processQueueLoop() {
  while (true) {
    const tasks = await loadPendingTasks();
    if (tasks.length === 0) {
      return;
    }

    const now = Date.now();
    const dueTasks = tasks.filter((task) => task.nextAttemptAtMs <= now);
    if (dueTasks.length === 0) {
      const nextAttemptAtMs = Math.min(...tasks.map((task) => task.nextAttemptAtMs));
      const waitMs = Math.max(0, Math.min(nextAttemptAtMs - now, MAX_BACKOFF_MS));
      await sleep(waitMs || 1000);
      continue;
    }

    dueTasks.sort((a, b) => a.nextAttemptAtMs - b.nextAttemptAtMs);
    for (const task of dueTasks) {
      await processSingleTask(task);
    }
  }
}

async function loadPendingTasks() {
  let entries = [];
  try {
    entries = await fs.readdir(QUEUE_PENDING_DIR);
  } catch {
    return [];
  }

  const tasks = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    const filePath = path.join(QUEUE_PENDING_DIR, entry);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const nextAttemptAtMs = Number.isFinite(Date.parse(parsed.nextAttemptAt))
        ? Date.parse(parsed.nextAttemptAt)
        : Date.now();
      tasks.push({
        ...parsed,
        filePath,
        fileName: entry,
        nextAttemptAtMs,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const malformedPath = path.join(QUEUE_DEAD_DIR, `${entry}.malformed`);
      await writeAtomic(malformedPath, `malformed queue item: ${reason}\n`);
      await fs.unlink(filePath).catch(() => {});
      process.stderr.write(`[agent-messenger] queue dropped malformed item file=${entry} reason=${reason}\n`);
    }
  }

  return tasks;
}

async function processSingleTask(task) {
  process.stdout.write(`[agent-messenger] sending id=${task.id} agent=${task.agentId} attempt=${task.attempts + 1}/${MAX_RETRIES}\n`);

  try {
    await execFile("openclaw", [
      "agent",
      "--agent",
      task.agentId,
      "--message",
      task.message,
      "--session-id",
      task.sessionId,
    ]);
    await fs.unlink(task.filePath).catch(() => {});
    process.stdout.write(`[agent-messenger] sent id=${task.id} agent=${task.agentId} session=${task.sessionId}\n`);
  } catch (error) {
    const nextAttempts = Number(task.attempts || 0) + 1;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (nextAttempts >= MAX_RETRIES) {
      const nowIso = new Date().toISOString();
      const deadPayload = {
        ...task,
        attempts: nextAttempts,
        updatedAt: nowIso,
        deadAt: nowIso,
        lastError: errorMessage,
      };
      const deadPath = path.join(QUEUE_DEAD_DIR, task.fileName);
      await writeAtomic(deadPath, `${JSON.stringify(deadPayload, null, 2)}\n`);
      await fs.unlink(task.filePath).catch(() => {});
      process.stderr.write(`[agent-messenger] dropped id=${task.id} agent=${task.agentId} attempts=${nextAttempts}/${MAX_RETRIES} reason=${errorMessage}\n`);
      return;
    }

    const delayMs = computeBackoffMs(nextAttempts);
    const nowIso = new Date().toISOString();
    const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
    const nextPayload = {
      ...task,
      attempts: nextAttempts,
      updatedAt: nowIso,
      nextAttemptAt,
      lastError: errorMessage,
    };
    await writeAtomic(task.filePath, `${JSON.stringify(nextPayload, null, 2)}\n`);
    process.stderr.write(`[agent-messenger] retry scheduled id=${task.id} agent=${task.agentId} attempts=${nextAttempts}/${MAX_RETRIES} wait_ms=${delayMs} reason=${errorMessage}\n`);
  }
}

function computeBackoffMs(attempts) {
  const multiplier = Math.max(0, attempts - 1);
  const delay = BASE_BACKOFF_MS * (3 ** multiplier);
  return Math.min(delay, MAX_BACKOFF_MS);
}

async function tryAcquireWorkerLock() {
  const payload = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
  };

  try {
    await fs.writeFile(WORKER_LOCK_FILE, `${JSON.stringify(payload)}\n`, { flag: "wx" });
    return { acquired: true, lockPath: WORKER_LOCK_FILE };
  } catch (error) {
    if (error && error.code !== "EEXIST") {
      throw error;
    }
  }

  try {
    const raw = await fs.readFile(WORKER_LOCK_FILE, "utf8");
    const lockState = JSON.parse(raw);
    if (typeof lockState?.pid === "number" && isProcessAlive(lockState.pid)) {
      return { acquired: false, lockPath: WORKER_LOCK_FILE };
    }
  } catch {
    // stale/invalid lock; remove below
  }

  await fs.unlink(WORKER_LOCK_FILE).catch(() => {});
  await fs.writeFile(WORKER_LOCK_FILE, `${JSON.stringify(payload)}\n`, { flag: "wx" });
  return { acquired: true, lockPath: WORKER_LOCK_FILE };
}

async function releaseWorkerLock(lock) {
  if (!lock?.lockPath) {
    return;
  }
  await fs.unlink(lock.lockPath).catch(() => {});
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function sendAgentMessage(args) {
  if (!args.agentId) {
    fail("--agent-id is required for send_agent");
  }
  if (!args.message) {
    fail("--message is required for send_agent");
  }
  if (!args.sessionId) {
    fail("--session-id is required for send_agent");
  }

  await execFile("openclaw", [
    "agent",
    "--agent",
    args.agentId,
    "--message",
    args.message,
    "--session-id",
    args.sessionId,
  ]);
  process.stdout.write(`✅ SENT_AGENT ${args.agentId}\n`);
}

async function sendBindingMessage(args) {
  validateBindingId(args.bindingId);
  if (!args.accountId) {
    fail("--account-id is required for send_binding_message");
  }
  if (!args.message) {
    fail("--message is required for send_binding_message");
  }

  const telegramTarget = parseTelegramChatTarget(args.bindingId);
  const response = await sendTelegramMessage({
    accountId: args.accountId,
    target: telegramTarget,
    message: args.message,
  });

  process.stdout.write(`✅ NOTIFIED ${args.bindingId} ${args.accountId}\n`);
  if (response?.messageId) {
    process.stdout.write(`✅ MESSAGE_ID ${response.messageId}\n`);
  }
}

function parseTelegramChatTarget(bindingId) {
  const match = bindingId.match(/^tg:(-?\d+)$/);
  if (!match) {
    fail("send_binding_message requires Telegram bindingId in format tg:<chatId>");
  }
  return match[1];
}

async function sendTelegramMessage({ accountId, target, message }) {
  const args = [
    "message",
    "send",
    "--channel",
    "telegram",
    "--account",
    accountId,
    "--target",
    target,
    "--message",
    message,
    "--json",
  ];
  const { stdout } = await execFile("openclaw", args);
  const jsonStart = stdout.indexOf("{");
  const jsonText = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
  return JSON.parse(jsonText);
}

async function execFile(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `command failed with exit code ${code}`));
    });
  });
}

async function writeAtomic(filePath, content) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}

function readPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
