import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { type LoomCliRuntime, type LoomCoordinationIssue, type LoomMission } from "./loom-cli.js";
import { buildTelegramUserMention, escapeHtml } from "./telegram.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type ReminderState = {
  sent: Record<string, string>;
};

type SendMessageInput = {
  chatId: string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
};

type MissionDeadlineReminderOptions = {
  intervalMs: number;
  reminderWindowMs: number;
  statePath: string;
  loomClient: LoomCliRuntime;
  sendMessage: (input: SendMessageInput) => Promise<void>;
  logger?: Logger;
  now?: () => number;
};

export type MissionDeadlineReminder = {
  start: () => void;
  stop: () => void;
  runNow: () => Promise<void>;
};

const defaultLogger: Logger = {
  info: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

export function createMissionDeadlineReminder(options: MissionDeadlineReminderOptions): MissionDeadlineReminder {
  const logger = options.logger ?? defaultLogger;
  const now = options.now ?? (() => Date.now());
  let timer: NodeJS.Timeout | null = null;

  function start(): void {
    if (timer) {
      return;
    }
    timer = setInterval(() => {
      void runNow().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[mission-reminder] ${message}`);
      });
    }, options.intervalMs);
  }

  function stop(): void {
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = null;
  }

  async function runNow(): Promise<void> {
    const state = await loadState(options.statePath);
    const currentNow = now();
    const issues = await options.loomClient.listCoordinationIssues();

    for (const issue of issues) {
      try {
        const issueId = readIssueId(issue);
        const chatId = readTelegramChatId(issue);
        const projectId = String(issue.projectId ?? "").trim();
        if (!issueId || !chatId || !projectId) {
          continue;
        }

        const missions = filterIssueMissions(await options.loomClient.listMissions(projectId), issue);
        for (const mission of missions) {
          const missionId = readMissionId(mission);
          const deadline = String(mission.deadline ?? "").trim();
          if (!missionId || !shouldRemindMission(mission, currentNow, options.reminderWindowMs)) {
            continue;
          }

          const reminderKey = `${issueId}:${missionId}:${deadline}`;
          if (state.sent[reminderKey]) {
            continue;
          }

          await options.sendMessage({
            chatId,
            text: buildReminderMessage(issue, mission),
            parseMode: "HTML",
          });
          state.sent[reminderKey] = new Date(currentNow).toISOString();
          logger.info(`[mission-reminder] sent ${issueId}/${missionId} -> ${chatId}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[mission-reminder] failed issue ${readIssueId(issue) || "unknown"}: ${message}`);
      }
    }

    await saveState(options.statePath, state);
  }

  return {
    start,
    stop,
    runNow,
  };
}

function shouldRemindMission(mission: LoomMission, currentNow: number, reminderWindowMs: number): boolean {
  const deadlineText = String(mission.deadline ?? "").trim();
  if (!deadlineText) {
    return false;
  }
  const deadlineMs = Date.parse(deadlineText);
  if (!Number.isFinite(deadlineMs)) {
    return false;
  }
  const status = String(mission.status ?? "").toUpperCase();
  if (status === "DONE" || status === "CANCELLED") {
    return false;
  }
  const diff = deadlineMs - currentNow;
  return diff >= 0 && diff <= reminderWindowMs;
}

function readTelegramChatId(issue: LoomCoordinationIssue): string {
  const content = issue.content;
  if (!content || typeof content !== "object") {
    return "";
  }
  return String((content as Record<string, unknown>).telegramChatId ?? "").trim();
}

function filterIssueMissions(missions: LoomMission[], issue: LoomCoordinationIssue): LoomMission[] {
  const missionIds = readIssueMissionIds(issue);
  if (missionIds.length === 0) {
    return missions;
  }
  const allowedMissionIds = new Set(missionIds);
  return missions.filter((mission) => allowedMissionIds.has(readMissionId(mission)));
}

function readIssueMissionIds(issue: LoomCoordinationIssue): string[] {
  const content = issue.content;
  if (!content || typeof content !== "object") {
    return [];
  }
  const ids = (content as Record<string, unknown>).missionIds;
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids.map((value) => String(value ?? "").trim()).filter(Boolean);
}

function readIssueId(issue: LoomCoordinationIssue): string {
  return String(issue.coordinationIssueId ?? issue.id ?? "").trim();
}

function readMissionId(mission: LoomMission): string {
  return String(mission.missionId ?? mission.id ?? "").trim();
}

function buildReminderMessage(issue: LoomCoordinationIssue, mission: LoomMission): string {
  const title = escapeHtml(String(mission.title ?? "未命名任务").trim() || "未命名任务");
  const issueTitle = escapeHtml(String(issue.title ?? "未命名协调事项").trim() || "未命名协调事项");
  const deadline = escapeHtml(String(mission.deadline ?? "未设置").trim() || "未设置");

  return [
    `${buildAssigneeText(mission)} 你负责的 mission 即将在 12 小时内到期。`,
    `任务：${title}`,
    `协调事项：${issueTitle}`,
    `截止时间：${deadline}`,
    "请尽快更新进展或完成交付。",
  ].join("\n");
}

function buildAssigneeText(mission: LoomMission): string {
  const assigneePlatform = String(mission.assigneePlatform ?? "").trim().toLowerCase();
  const assigneePlatformId = String(mission.assigneePlatformId ?? "").trim();
  const label = String(mission.assigneeEmail ?? mission.assigneeId ?? "负责人").trim() || "负责人";
  if (assigneePlatform === "telegram" && assigneePlatformId) {
    return buildTelegramUserMention(assigneePlatformId, label);
  }
  return escapeHtml(label);
}

async function loadState(statePath: string): Promise<ReminderState> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ReminderState>;
    return {
      sent: parsed.sent && typeof parsed.sent === "object" ? parsed.sent as Record<string, string> : {},
    };
  } catch {
    return { sent: {} };
  }
}

async function saveState(statePath: string, state: ReminderState): Promise<void> {
  await fs.mkdir(dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
