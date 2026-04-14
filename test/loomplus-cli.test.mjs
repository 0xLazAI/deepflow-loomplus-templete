import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const cliToken = "loomplus-test-token";

describe("loom+ cli api", () => {
  let docsRoot;
  let createApp;

  beforeEach(async () => {
    docsRoot = await mkdtemp(path.join(tmpdir(), "loomplus-docs-"));
    ({ createApp } = await import("../dist/app/create-app.js"));
  });

  afterEach(async () => {
    if (docsRoot) {
      await rm(docsRoot, { recursive: true, force: true });
    }
  });

  test("login, list tools, and create a coordination issue with artifacts", async () => {
    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/api/cli/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: cliToken }),
      });

      expect(loginResponse.status).toBe(200);
      const loginJson = await loginResponse.json();
      expect(loginJson.user.email).toBe("loomplus@example.com");

      const toolsResponse = await fetch(`${baseUrl}/api/cli/tools`, {
        headers: { Authorization: `Bearer ${cliToken}` },
      });
      expect(toolsResponse.status).toBe(200);
      const toolsJson = await toolsResponse.json();
      expect(Array.isArray(toolsJson.tools)).toBe(true);
      expect(toolsJson.tools.some((tool) => tool.name === "create_coordination_issue")).toBe(true);

      const projectResponse = await fetch(`${baseUrl}/api/cli/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cliToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "create_project",
          args: {
            name: "Hot Response",
            description: "loom+ v0 project",
          },
        }),
      });
      expect(projectResponse.status).toBe(200);
      const projectJson = await projectResponse.json();
      expect(projectJson.result.name).toBe("Hot Response");

      const createIssueResponse = await fetch(`${baseUrl}/api/cli/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cliToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "create_coordination_issue",
          args: {
            projectId: projectJson.result.id,
            title: "Follow tonight trend",
            type: "coordination_start",
            sourceInput: "Tonight follow this trend before tomorrow morning.",
            initiator: "owner:jerry",
            affectedScope: ["content", "design"],
            requiredGates: ["create_task_confirmation"],
            assignees: ["Jerry", "Tom"],
            routingTargets: ["group:hot-response", "dm:Jerry", "dm:Tom"],
            summary: "Prepare content and cover image for the trend.",
            deadline: "2026-04-15T10:00:00Z",
          },
        }),
      });
      expect(createIssueResponse.status).toBe(200);
      const issueJson = await createIssueResponse.json();
      expect(issueJson.result.currentStatus).toBe("pending_confirmation");
      expect(issueJson.result.requiredGates).toEqual(["create_task_confirmation"]);

      const issueRoot = path.join(
        docsRoot,
        "loomplus",
        "projects",
        projectJson.result.id,
        "coordination",
        issueJson.result.id,
      );
      const intentBrief = await readFile(path.join(issueRoot, "intent-brief.md"), "utf8");
      const routingReceipt = await readFile(path.join(issueRoot, "routing-receipt.md"), "utf8");
      expect(intentBrief).toContain("Tonight follow this trend before tomorrow morning.");
      expect(routingReceipt).toContain("create_task_confirmation");

      const logsResponse = await fetch(`${baseUrl}/api/cli/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cliToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "get_coordination_issue_logs",
          args: {
            coordinationIssueId: issueJson.result.id,
          },
        }),
      });
      expect(logsResponse.status).toBe(200);
      const logsJson = await logsResponse.json();
      expect(logsJson.result.events).toHaveLength(1);
      expect(logsJson.result.events[0].type).toBe("issue_created");
    });
  });

  test("coordination issue status transitions are validated", async () => {
    await withServer(async (baseUrl) => {
      const projectId = await createProject(baseUrl);
      const issueId = await createIssue(baseUrl, projectId);

      const invalidTransitionResponse = await fetch(`${baseUrl}/api/cli/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cliToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "update_coordination_issue",
          args: {
            coordinationIssueId: issueId,
            currentStatus: "summarized",
          },
        }),
      });

      expect(invalidTransitionResponse.status).toBe(500);
      const invalidTransitionJson = await invalidTransitionResponse.json();
      expect(invalidTransitionJson.error).toContain("Invalid coordination issue transition");
    });
  });

  test("hot response flow creates gated coordination issue and status snapshot", async () => {
    await withServer(async (baseUrl) => {
      const projectId = await createProject(baseUrl);

      const response = await fetch(`${baseUrl}/api/cli/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cliToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "create_hot_response_issue",
          args: {
            projectId,
            topic: "ETH ETF reaction",
            sourceInput: "Tonight follow the ETF trend and prepare content plus cover image.",
            initiator: "owner:pm",
            deadline: "2026-04-15T09:00:00Z",
            contentOwner: "Jerry",
            designOwner: "Tom",
            approver: "PM",
            channels: ["group:crypto-ai", "dm:Jerry", "dm:Tom"],
            outputs: ["English thread", "Chinese recap", "Cover image"],
          },
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.result.type).toBe("coordination_start");
      expect(json.result.currentStatus).toBe("pending_confirmation");
      expect(json.result.requiredGates).toEqual(["create_task_confirmation"]);

      const snapshotResponse = await fetch(`${baseUrl}/api/cli/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cliToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "get_status_snapshot",
          args: {
            coordinationIssueId: json.result.id,
          },
        }),
      });

      expect(snapshotResponse.status).toBe(200);
      const snapshotJson = await snapshotResponse.json();
      expect(snapshotJson.result.snapshot).toContain("Hot response: ETH ETF reaction");
      expect(snapshotJson.result.blockers).toContain("Waiting for gate: create_task_confirmation");
    });
  });

  test("meeting follow-up flow creates issue with decision gates", async () => {
    await withServer(async (baseUrl) => {
      const projectId = await createProject(baseUrl);

      const response = await fetch(`${baseUrl}/api/cli/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cliToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "create_meeting_followup_issue",
          args: {
            projectId,
            title: "Exchange partnership sync",
            sourceInput: "Turn the partner meeting into execution flow and show me the top 3 actions.",
            initiator: "owner:pm",
            meetingLink: "https://meet.example.com/demo",
            summary: "The partner wants a pilot launch and a legal review.",
            decisions: ["Proceed with pilot scope", "Share timeline by Friday"],
            followups: ["Draft pilot plan", "Schedule legal review"],
            attendees: ["Alice", "Bob"],
            channels: ["group:partnership", "dm:Alice"],
          },
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.result.type).toBe("meeting_followup");
      expect(json.result.currentStatus).toBe("pending_confirmation");
      expect(json.result.requiredGates).toEqual(["confirm_action_items", "confirm_decisions"]);

      const issueRoot = path.join(
        docsRoot,
        "loomplus",
        "projects",
        projectId,
        "coordination",
        json.result.id,
      );
      const summaryDigest = await readFile(path.join(issueRoot, "summary-digest.md"), "utf8");
      expect(summaryDigest).toContain("Proceed with pilot scope");
      expect(summaryDigest).toContain("Schedule legal review");
    });
  });

  async function withServer(run) {
    const app = createApp({
      docsRoot,
      openclawGatewayUrl: "http://127.0.0.1:18789",
      docsAuthToken: "",
      docsProjectAuthFileName: ".docs-auth.json",
      isGatewayReady: () => true,
      loomPlusCliTokens: [cliToken],
      loomPlusCliUserId: "loomplus-user",
      loomPlusCliUserEmail: "loomplus@example.com",
    });

    const server = await new Promise((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      await run(baseUrl);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(undefined);
        });
      });
    }
  }

  async function createProject(baseUrl) {
    const response = await fetch(`${baseUrl}/api/cli/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cliToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "create_project",
        args: { name: "Meetings" },
      }),
    });
    const json = await response.json();
    return json.result.id;
  }

  async function createIssue(baseUrl, projectId) {
    const response = await fetch(`${baseUrl}/api/cli/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cliToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "create_coordination_issue",
        args: {
          projectId,
          title: "Meeting follow-up",
          type: "meeting_followup",
          sourceInput: "Turn this meeting into next actions.",
          assignees: ["Alice"],
          routingTargets: ["dm:Alice"],
        },
      }),
    });
    const json = await response.json();
    return json.result.id;
  }
});
