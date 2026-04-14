import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import crypto from "node:crypto";

export const coordinationStatuses = [
  "received",
  "parsed",
  "planned",
  "routed",
  "pending_confirmation",
  "executing",
  "receipted",
  "summarized",
  "closed",
] as const;

export const coordinationTypes = [
  "coordination_start",
  "task_dispatch",
  "status_request",
  "status_update",
  "meeting_followup",
  "decision_broadcast",
  "brief_generation",
  "reminder_trigger",
] as const;

export type CoordinationStatus = (typeof coordinationStatuses)[number];
export type CoordinationType = (typeof coordinationTypes)[number];

export type LoomPlusProjectStatus = "UNASSIGNED" | "IN_PROGRESS" | "REVIEW" | "DONE" | "CANCELLED";

export type LoomPlusProject = {
  id: string;
  name: string;
  description: string;
  status: LoomPlusProjectStatus;
  creatorEmail: string;
  creatorPlatform: string;
  creatorPlatformId: string;
  createdAt: string;
  updatedAt: string;
};

export type CoordinationEvent = {
  id: string;
  type: string;
  at: string;
  summary: string;
  metadata: Record<string, unknown>;
};

export type CoordinationIssue = {
  id: string;
  projectId: string;
  title: string;
  type: CoordinationType;
  sourceInput: string;
  initiator: string;
  currentStatus: CoordinationStatus;
  affectedScope: string[];
  requiredGates: string[];
  assignees: string[];
  summary: string;
  deadline: string;
  routingTargets: string[];
  createdAt: string;
  updatedAt: string;
  events: CoordinationEvent[];
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  creatorEmail?: string;
  creatorPlatform?: string;
  creatorPlatformId?: string;
};

export type UpdateProjectInput = {
  projectId: string;
  name?: string;
  description?: string;
  status?: LoomPlusProjectStatus;
};

export type CreateCoordinationIssueInput = {
  projectId: string;
  title: string;
  type: CoordinationType;
  sourceInput: string;
  initiator?: string;
  affectedScope?: string[];
  requiredGates?: string[];
  assignees?: string[];
  summary?: string;
  deadline?: string;
  routingTargets?: string[];
};

export type UpdateCoordinationIssueInput = {
  coordinationIssueId: string;
  title?: string;
  summary?: string;
  currentStatus?: CoordinationStatus;
  requiredGates?: string[];
  assignees?: string[];
  deadline?: string;
  routingTargets?: string[];
  affectedScope?: string[];
  sourceInput?: string;
};

export type CreateHotResponseInput = {
  projectId: string;
  topic: string;
  sourceInput: string;
  initiator?: string;
  deadline?: string;
  contentOwner?: string;
  designOwner?: string;
  approver?: string;
  channels?: string[];
  outputs?: string[];
};

export type CreateMeetingFollowupInput = {
  projectId: string;
  title: string;
  sourceInput: string;
  initiator?: string;
  meetingLink?: string;
  summary?: string;
  decisions?: string[];
  followups?: string[];
  attendees?: string[];
  channels?: string[];
};

type LoomPlusServiceOptions = {
  docsRoot: string;
};

const projectStatuses: LoomPlusProjectStatus[] = ["UNASSIGNED", "IN_PROGRESS", "REVIEW", "DONE", "CANCELLED"];

const artifactFileNames = [
  "intent-brief.md",
  "coordination-card.md",
  "routing-receipt.md",
  "status-snapshot.md",
  "execution-receipt.md",
  "summary-digest.md",
  "rule-update.md",
] as const;

const allowedTransitions: Record<CoordinationStatus, CoordinationStatus[]> = {
  received: ["parsed", "closed"],
  parsed: ["planned", "closed"],
  planned: ["routed", "pending_confirmation", "closed"],
  routed: ["pending_confirmation", "executing", "closed"],
  pending_confirmation: ["planned", "executing", "closed"],
  executing: ["receipted", "summarized", "closed"],
  receipted: ["summarized", "closed"],
  summarized: ["closed"],
  closed: [],
};

export type LoomPlusService = ReturnType<typeof createLoomPlusService>;

export function createLoomPlusService(options: LoomPlusServiceOptions) {
  const rootDir = join(options.docsRoot, "loomplus");
  const projectsDir = join(rootDir, "projects");

  async function ensureStore(): Promise<void> {
    await fs.mkdir(projectsDir, { recursive: true });
  }

  async function listProjects(): Promise<LoomPlusProject[]> {
    await ensureStore();
    const entries = await fs.readdir(projectsDir, { withFileTypes: true }).catch(() => []);
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => readProject(entry.name)),
    );
    return projects.filter((project): project is LoomPlusProject => project !== null).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function getProject(projectId: string): Promise<LoomPlusProject> {
    const project = await readProject(projectId);
    if (!project) {
      throw new Error(`Unknown project: ${projectId}`);
    }
    return project;
  }

  async function getProjectIdByName(name: string): Promise<{ projectId: string | null }> {
    validateNonEmpty(name, "name");
    const projects = await listProjects();
    const match = projects.find((project) => project.name === name);
    return { projectId: match?.id ?? null };
  }

  async function createProject(input: CreateProjectInput): Promise<LoomPlusProject> {
    validateNonEmpty(input.name, "name");
    const now = nowIso();
    const project: LoomPlusProject = {
      id: `project_${crypto.randomUUID()}`,
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      status: "UNASSIGNED",
      creatorEmail: (input.creatorEmail ?? "").trim(),
      creatorPlatform: (input.creatorPlatform ?? "").trim(),
      creatorPlatformId: (input.creatorPlatformId ?? "").trim(),
      createdAt: now,
      updatedAt: now,
    };
    await writeProject(project);
    return project;
  }

  async function updateProject(input: UpdateProjectInput): Promise<LoomPlusProject> {
    const project = await getProject(input.projectId);
    if (input.status && !projectStatuses.includes(input.status)) {
      throw new Error(`Invalid project status: ${input.status}`);
    }
    const updated: LoomPlusProject = {
      ...project,
      name: input.name !== undefined ? input.name.trim() : project.name,
      description: input.description !== undefined ? input.description.trim() : project.description,
      status: input.status ?? project.status,
      updatedAt: nowIso(),
    };
    validateNonEmpty(updated.name, "name");
    await writeProject(updated);
    return updated;
  }

  async function updateProjectStatus(projectId: string, status: LoomPlusProjectStatus): Promise<LoomPlusProject> {
    return updateProject({ projectId, status });
  }

  async function listCoordinationIssues(projectId?: string): Promise<CoordinationIssue[]> {
    await ensureStore();
    const projects = projectId ? [await getProject(projectId)] : await listProjects();
    const issues = await Promise.all(projects.map(async (project) => readProjectIssues(project.id)));
    return issues.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function getCoordinationIssue(coordinationIssueId: string): Promise<CoordinationIssue> {
    const projectEntries = await fs.readdir(projectsDir, { withFileTypes: true }).catch(() => []);
    for (const entry of projectEntries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const filePath = issueFilePath(entry.name, coordinationIssueId);
      const issue = await readJsonFile<CoordinationIssue>(filePath);
      if (issue) {
        return issue;
      }
    }
    throw new Error(`Unknown coordination issue: ${coordinationIssueId}`);
  }

  async function createCoordinationIssue(input: CreateCoordinationIssueInput): Promise<CoordinationIssue> {
    await getProject(input.projectId);
    validateNonEmpty(input.title, "title");
    validateNonEmpty(input.sourceInput, "sourceInput");
    validateCoordinationType(input.type);

    const now = nowIso();
    const requiredGates = sanitizeList(input.requiredGates);
    const assignees = sanitizeList(input.assignees);
    const routingTargets = sanitizeList(input.routingTargets);
    const issueId = `issue_${crypto.randomUUID()}`;
    const initialStatus = requiredGates.length > 0 ? "pending_confirmation" : routingTargets.length > 0 || assignees.length > 0 ? "routed" : "planned";
    const summary = input.summary?.trim() || `Coordination issue for ${input.title.trim()}.`;

    const issue: CoordinationIssue = {
      id: issueId,
      projectId: input.projectId,
      title: input.title.trim(),
      type: input.type,
      sourceInput: input.sourceInput.trim(),
      initiator: (input.initiator ?? "unknown").trim() || "unknown",
      currentStatus: initialStatus,
      affectedScope: sanitizeList(input.affectedScope),
      requiredGates,
      assignees,
      summary,
      deadline: (input.deadline ?? "").trim(),
      routingTargets,
      createdAt: now,
      updatedAt: now,
      events: [
        createEvent("issue_created", `Issue created and entered ${initialStatus}.`, {
          currentStatus: initialStatus,
          requiredGates,
          routingTargets,
        }, now),
      ],
    };

    await writeIssue(issue);
    await writeIssueArtifacts(issue);
    return issue;
  }

  async function updateCoordinationIssue(input: UpdateCoordinationIssueInput): Promise<CoordinationIssue> {
    const issue = await getCoordinationIssue(input.coordinationIssueId);
    let nextStatus = issue.currentStatus;
    if (input.currentStatus) {
      validateCoordinationStatus(input.currentStatus);
      if (input.currentStatus !== issue.currentStatus && !allowedTransitions[issue.currentStatus].includes(input.currentStatus)) {
        throw new Error(`Invalid coordination issue transition: ${issue.currentStatus} -> ${input.currentStatus}`);
      }
      nextStatus = input.currentStatus;
    }

    const updatedAt = nowIso();
    const updated: CoordinationIssue = {
      ...issue,
      title: input.title !== undefined ? input.title.trim() : issue.title,
      summary: input.summary !== undefined ? input.summary.trim() : issue.summary,
      currentStatus: nextStatus,
      requiredGates: input.requiredGates !== undefined ? sanitizeList(input.requiredGates) : issue.requiredGates,
      assignees: input.assignees !== undefined ? sanitizeList(input.assignees) : issue.assignees,
      deadline: input.deadline !== undefined ? input.deadline.trim() : issue.deadline,
      routingTargets: input.routingTargets !== undefined ? sanitizeList(input.routingTargets) : issue.routingTargets,
      affectedScope: input.affectedScope !== undefined ? sanitizeList(input.affectedScope) : issue.affectedScope,
      sourceInput: input.sourceInput !== undefined ? input.sourceInput.trim() : issue.sourceInput,
      updatedAt,
      events: [
        ...issue.events,
        createEvent("issue_updated", buildUpdateSummary(issue.currentStatus, nextStatus), {
          previousStatus: issue.currentStatus,
          currentStatus: nextStatus,
        }, updatedAt),
      ],
    };

    validateNonEmpty(updated.title, "title");
    validateNonEmpty(updated.sourceInput, "sourceInput");
    await writeIssue(updated);
    await writeIssueArtifacts(updated);
    return updated;
  }

  async function getCoordinationIssueLogs(coordinationIssueId: string): Promise<CoordinationEvent[]> {
    const issue = await getCoordinationIssue(coordinationIssueId);
    return issue.events;
  }

  async function getCoordinationIssueSnapshot(coordinationIssueId: string): Promise<{
    coordinationIssueId: string;
    title: string;
    currentStatus: CoordinationStatus;
    summary: string;
    blockers: string[];
    nextStep: string;
    snapshot: string;
  }> {
    const issue = await getCoordinationIssue(coordinationIssueId);
    const blockers = issue.requiredGates.map((gate) => `Waiting for gate: ${gate}`);
    const nextStep = blockers.length > 0
      ? "Confirm the pending gate(s) so execution can begin."
      : issue.currentStatus === "routed"
        ? "Collect receipts from routed owners."
        : issue.currentStatus === "executing"
          ? "Wait for execution receipt and summarize progress."
          : issue.currentStatus === "summarized"
            ? "Review the summary and close or iterate."
            : `Advance the issue from ${issue.currentStatus}.`;
    const snapshot = `${issue.title}: ${issue.currentStatus}. ${issue.summary}`;
    return {
      coordinationIssueId: issue.id,
      title: issue.title,
      currentStatus: issue.currentStatus,
      summary: issue.summary,
      blockers,
      nextStep,
      snapshot,
    };
  }

  async function createHotResponseIssue(input: CreateHotResponseInput): Promise<CoordinationIssue> {
    const outputs = sanitizeList(input.outputs);
    const assignees = sanitizeList([input.contentOwner ?? "", input.designOwner ?? "", input.approver ?? ""]);
    const channels = sanitizeList(input.channels);
    const affectedScope = [
      "hot-response",
      ...outputs,
    ];
    const summaryParts = [
      `Follow the topic \"${input.topic.trim()}\" on a fast cycle.`,
      outputs.length > 0 ? `Deliverables: ${outputs.join(", ")}.` : "Deliverables: team-defined outputs.",
      input.deadline?.trim() ? `Deadline: ${input.deadline.trim()}.` : "",
    ].filter((part) => part.length > 0);

    return createCoordinationIssue({
      projectId: input.projectId,
      title: `Hot response: ${input.topic.trim()}`,
      type: "coordination_start",
      sourceInput: input.sourceInput,
      initiator: input.initiator,
      affectedScope,
      requiredGates: ["create_task_confirmation"],
      assignees,
      summary: summaryParts.join(" "),
      deadline: input.deadline,
      routingTargets: channels,
    });
  }

  async function createMeetingFollowupIssue(input: CreateMeetingFollowupInput): Promise<CoordinationIssue> {
    const decisions = sanitizeList(input.decisions);
    const followups = sanitizeList(input.followups);
    const attendees = sanitizeList(input.attendees);
    const channels = sanitizeList(input.channels);
    const summarySegments = [
      input.summary?.trim() || `Convert the meeting \"${input.title.trim()}\" into execution flow.`,
      decisions.length > 0 ? `Decisions: ${decisions.join("; ")}.` : "",
      followups.length > 0 ? `Follow-ups: ${followups.join("; ")}.` : "",
      input.meetingLink?.trim() ? `Meeting link: ${input.meetingLink.trim()}.` : "",
    ].filter((part) => part.length > 0);

    return createCoordinationIssue({
      projectId: input.projectId,
      title: `Meeting follow-up: ${input.title.trim()}`,
      type: "meeting_followup",
      sourceInput: input.sourceInput,
      initiator: input.initiator,
      affectedScope: ["meeting-followup", ...decisions, ...followups],
      requiredGates: ["confirm_action_items", "confirm_decisions"],
      assignees: attendees,
      summary: summarySegments.join(" "),
      routingTargets: channels,
    });
  }

  async function readProject(projectId: string): Promise<LoomPlusProject | null> {
    return readJsonFile<LoomPlusProject>(projectFilePath(projectId));
  }

  async function readProjectIssues(projectId: string): Promise<CoordinationIssue[]> {
    const coordinationDir = join(projectDir(projectId), "coordination");
    const entries = await fs.readdir(coordinationDir, { withFileTypes: true }).catch(() => []);
    const issues = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => readJsonFile<CoordinationIssue>(issueFilePath(projectId, entry.name))),
    );
    return issues.filter((issue): issue is CoordinationIssue => issue !== null);
  }

  async function writeProject(project: LoomPlusProject): Promise<void> {
    await writeJsonFile(projectFilePath(project.id), project);
  }

  async function writeIssue(issue: CoordinationIssue): Promise<void> {
    await writeJsonFile(issueFilePath(issue.projectId, issue.id), issue);
  }

  async function writeIssueArtifacts(issue: CoordinationIssue): Promise<void> {
    const files = buildArtifactContents(issue);
    await Promise.all(
      artifactFileNames.map(async (fileName) => {
        const content = files[fileName];
        await writeTextFile(join(issueDir(issue.projectId, issue.id), fileName), content);
      }),
    );
  }

  return {
    ensureStore,
    listProjects,
    getProject,
    getProjectIdByName,
    createProject,
    updateProject,
    updateProjectStatus,
    listCoordinationIssues,
    getCoordinationIssue,
    createCoordinationIssue,
    updateCoordinationIssue,
    getCoordinationIssueLogs,
    getCoordinationIssueSnapshot,
    createHotResponseIssue,
    createMeetingFollowupIssue,
  };

  function projectDir(projectId: string): string {
    return join(projectsDir, projectId);
  }

  function projectFilePath(projectId: string): string {
    return join(projectDir(projectId), "project.json");
  }

  function issueDir(projectId: string, issueId: string): string {
    return join(projectDir(projectId), "coordination", issueId);
  }

  function issueFilePath(projectId: string, issueId: string): string {
    return join(issueDir(projectId, issueId), "issue.json");
  }
}

function validateNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function validateCoordinationType(value: string): asserts value is CoordinationType {
  if (!(coordinationTypes as readonly string[]).includes(value)) {
    throw new Error(`Invalid coordination issue type: ${value}`);
  }
}

function validateCoordinationStatus(value: string): asserts value is CoordinationStatus {
  if (!(coordinationStatuses as readonly string[]).includes(value)) {
    throw new Error(`Invalid coordination issue status: ${value}`);
  }
}

function sanitizeList(items: string[] | undefined): string[] {
  return (items ?? []).map((item) => String(item).trim()).filter((item) => item.length > 0);
}

function nowIso(): string {
  return new Date().toISOString();
}

function createEvent(type: string, summary: string, metadata: Record<string, unknown>, at: string): CoordinationEvent {
  return {
    id: `event_${crypto.randomUUID()}`,
    type,
    at,
    summary,
    metadata,
  };
}

function buildUpdateSummary(previousStatus: CoordinationStatus, currentStatus: CoordinationStatus): string {
  if (previousStatus === currentStatus) {
    return `Issue updated while staying in ${currentStatus}.`;
  }
  return `Issue moved from ${previousStatus} to ${currentStatus}.`;
}

function buildArtifactContents(issue: CoordinationIssue): Record<(typeof artifactFileNames)[number], string> {
  const scopeLines = issue.affectedScope.length > 0 ? issue.affectedScope.map((item) => `- ${item}`).join("\n") : "- none";
  const gateLines = issue.requiredGates.length > 0 ? issue.requiredGates.map((item) => `- ${item}`).join("\n") : "- none";
  const assigneeLines = issue.assignees.length > 0 ? issue.assignees.map((item) => `- ${item}`).join("\n") : "- none";
  const routeLines = issue.routingTargets.length > 0 ? issue.routingTargets.map((item) => `- ${item}`).join("\n") : "- none";
  const latestEvent = issue.events[issue.events.length - 1];

  return {
    "intent-brief.md": [
      `# Intent Brief`,
      "",
      `- Issue: ${issue.id}`,
      `- Type: ${issue.type}`,
      `- Initiator: ${issue.initiator}`,
      `- Source Input: ${issue.sourceInput}`,
      `- Summary: ${issue.summary}`,
      `- Deadline: ${issue.deadline || "unset"}`,
    ].join("\n"),
    "coordination-card.md": [
      `# Coordination Card`,
      "",
      `- Title: ${issue.title}`,
      `- Status: ${issue.currentStatus}`,
      `- Project: ${issue.projectId}`,
      `- Created At: ${issue.createdAt}`,
      "",
      `## Affected Scope`,
      scopeLines,
      "",
      `## Assignees`,
      assigneeLines,
    ].join("\n"),
    "routing-receipt.md": [
      `# Routing Receipt`,
      "",
      `- Current Status: ${issue.currentStatus}`,
      `- Routing Targets:`,
      routeLines,
      "",
      `## Required Gates`,
      gateLines,
    ].join("\n"),
    "status-snapshot.md": [
      `# Status Snapshot`,
      "",
      `- Title: ${issue.title}`,
      `- Status: ${issue.currentStatus}`,
      `- Last Updated: ${issue.updatedAt}`,
      `- Latest Event: ${latestEvent.summary}`,
    ].join("\n"),
    "execution-receipt.md": [
      `# Execution Receipt`,
      "",
      `- Latest Event: ${latestEvent.type}`,
      `- Summary: ${latestEvent.summary}`,
      `- At: ${latestEvent.at}`,
    ].join("\n"),
    "summary-digest.md": [
      `# Summary Digest`,
      "",
      issue.summary,
      "",
      `Current status: ${issue.currentStatus}.`,
    ].join("\n"),
    "rule-update.md": [
      `# Rule Update`,
      "",
      `No memory update has been accepted for this issue yet.`,
    ].join("\n"),
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await writeTextFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${content.replace(/\s+$/u, "")}\n`, "utf8");
}
