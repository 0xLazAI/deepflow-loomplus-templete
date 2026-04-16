import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("mission deadline reminder", () => {
  let runtimeRoot;
  let createMissionDeadlineReminder;

  beforeEach(async () => {
    runtimeRoot = await mkdtemp(path.join(tmpdir(), "mission-reminder-"));
    ({ createMissionDeadlineReminder } = await import("../dist/runtime/mission-deadline-reminder.js"));
  });

  afterEach(async () => {
    if (runtimeRoot) {
      await rm(runtimeRoot, { recursive: true, force: true });
    }
  });

  test("sends one reminder with telegram mention for due mission and does not duplicate", async () => {
    let now = Date.parse("2026-04-14T00:00:00Z");
    const sent = [];
    const scheduler = createMissionDeadlineReminder({
      intervalMs: 3600_000,
      reminderWindowMs: 12 * 60 * 60 * 1000,
      statePath: path.join(runtimeRoot, "state.json"),
      now: () => now,
      loomClient: {
        listCoordinationIssues: async () => [{
          coordinationIssueId: "issue_1",
          projectId: "project_1",
          title: "Hot response",
          content: { telegramChatId: "-1001234567890", missionIds: ["mission_1"] },
        }],
        listMissions: async () => [{
          missionId: "mission_1",
          title: "Ship feature",
          deadline: "2026-04-14T11:00:00Z",
          status: "IN_PROGRESS",
          assigneeEmail: "owner@example.com",
          assigneePlatform: "telegram",
          assigneePlatformId: "123456",
        }],
      },
      sendMessage: async (payload) => {
        sent.push(payload);
      },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    });

    await scheduler.runNow();
    await scheduler.runNow();

    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe("-1001234567890");
    expect(sent[0].parseMode).toBe("HTML");
    expect(sent[0].text).toContain("tg://user?id=123456");
    expect(sent[0].text).toContain("Ship feature");
    now += 1000;
  });

  test("skips missions outside window or already done", async () => {
    const sent = [];
    const scheduler = createMissionDeadlineReminder({
      intervalMs: 3600_000,
      reminderWindowMs: 12 * 60 * 60 * 1000,
      statePath: path.join(runtimeRoot, "state.json"),
      now: () => Date.parse("2026-04-14T00:00:00Z"),
      loomClient: {
        listCoordinationIssues: async () => [{
          coordinationIssueId: "issue_1",
          projectId: "project_1",
          title: "Hot response",
          content: { telegramChatId: "-1001234567890" },
        }],
        listMissions: async () => [
          {
            missionId: "mission_far",
            title: "Far task",
            deadline: "2026-04-15T13:00:00Z",
            status: "IN_PROGRESS",
            assigneePlatform: "telegram",
            assigneePlatformId: "123456",
          },
          {
            missionId: "mission_done",
            title: "Done task",
            deadline: "2026-04-14T05:00:00Z",
            status: "DONE",
            assigneePlatform: "telegram",
            assigneePlatformId: "123456",
          },
        ],
      },
      sendMessage: async (payload) => {
        sent.push(payload);
      },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    });

    await scheduler.runNow();

    expect(sent).toHaveLength(0);
  });
});
