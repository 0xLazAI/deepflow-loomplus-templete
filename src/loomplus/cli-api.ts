import {
  coordinationStatuses,
  coordinationTypes,
  createLoomPlusService,
  type CoordinationStatus,
  type CoordinationType,
  type LoomPlusService,
} from "./service.js";

type ToolProperty = {
  type: string;
  required?: boolean;
  description: string;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, ToolProperty>;
  };
  run: (args: Record<string, unknown>, service: LoomPlusService) => Promise<unknown>;
};

export type LoomPlusCliApi = ReturnType<typeof createLoomPlusCliApi>;

export function createLoomPlusCliApi(docsRoot: string) {
  const service = createLoomPlusService({ docsRoot });
  const tools = buildTools();
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

  async function listTools() {
    await service.ensureStore();
    return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  }

  async function runTool(name: string, args: Record<string, unknown>) {
    const tool = toolMap.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    await service.ensureStore();
    return tool.run(args, service);
  }

  return {
    service,
    listTools,
    runTool,
  };
}

function buildTools(): ToolDefinition[] {
  return [
    {
      name: "list_projects",
      description: "List loom+ projects.",
      inputSchema: objectSchema({}),
      run: async (_args, service) => ({ projects: await service.listProjects() }),
    },
    {
      name: "get_project_id_by_name",
      description: "Resolve a project id from a project name.",
      inputSchema: objectSchema({
        name: stringProp(true, "Project display name"),
      }),
      run: async (args, service) => service.getProjectIdByName(readString(args.name, "name")),
    },
    {
      name: "create_project",
      description: "Create a loom+ project.",
      inputSchema: objectSchema({
        name: stringProp(true, "Project name"),
        description: stringProp(false, "Project description"),
        creatorEmail: stringProp(false, "Creator email"),
        creatorPlatform: stringProp(false, "Creator platform"),
        creatorPlatformId: stringProp(false, "Creator platform user id"),
      }),
      run: async (args, service) => service.createProject({
        name: readString(args.name, "name"),
        description: readOptionalString(args.description),
        creatorEmail: readOptionalString(args.creatorEmail),
        creatorPlatform: readOptionalString(args.creatorPlatform),
        creatorPlatformId: readOptionalString(args.creatorPlatformId),
      }),
    },
    {
      name: "update_project",
      description: "Update a loom+ project.",
      inputSchema: objectSchema({
        projectId: stringProp(true, "Project id"),
        name: stringProp(false, "Project name"),
        description: stringProp(false, "Project description"),
        status: enumProp(false, "Project status", ["UNASSIGNED", "IN_PROGRESS", "REVIEW", "DONE", "CANCELLED"]),
      }),
      run: async (args, service) => service.updateProject({
        projectId: readString(args.projectId, "projectId"),
        name: readOptionalString(args.name),
        description: readOptionalString(args.description),
        status: readOptionalString(args.status) as "UNASSIGNED" | "IN_PROGRESS" | "REVIEW" | "DONE" | "CANCELLED" | undefined,
      }),
    },
    {
      name: "update_project_status",
      description: "Update only the project status.",
      inputSchema: objectSchema({
        projectId: stringProp(true, "Project id"),
        status: enumProp(true, "Project status", ["UNASSIGNED", "IN_PROGRESS", "REVIEW", "DONE", "CANCELLED"]),
      }),
      run: async (args, service) => service.updateProjectStatus(
        readString(args.projectId, "projectId"),
        readString(args.status, "status") as "UNASSIGNED" | "IN_PROGRESS" | "REVIEW" | "DONE" | "CANCELLED",
      ),
    },
    {
      name: "list_coordination_issues",
      description: "List coordination issues for one project or all projects.",
      inputSchema: objectSchema({
        projectId: stringProp(false, "Project id filter"),
      }),
      run: async (args, service) => ({
        coordinationIssues: await service.listCoordinationIssues(readOptionalString(args.projectId)),
      }),
    },
    {
      name: "get_coordination_issue",
      description: "Get one coordination issue.",
      inputSchema: objectSchema({
        coordinationIssueId: stringProp(true, "Coordination issue id"),
      }),
      run: async (args, service) => service.getCoordinationIssue(readString(args.coordinationIssueId, "coordinationIssueId")),
    },
    {
      name: "create_coordination_issue",
      description: "Create a coordination issue and its baseline artifacts.",
      inputSchema: objectSchema({
        projectId: stringProp(true, "Project id"),
        title: stringProp(true, "Issue title"),
        type: enumProp(true, "Coordination issue type", [...coordinationTypes]),
        sourceInput: stringProp(true, "Raw input that triggered the issue"),
        content: objectProp(false, "Structured issue payload"),
        initiator: stringProp(false, "Initiator id or label"),
        affectedScope: arrayProp(false, "Affected scopes"),
        requiredGates: arrayProp(false, "Human confirmation gates"),
        assignees: arrayProp(false, "Target owners"),
        summary: stringProp(false, "Human-readable summary"),
        deadline: stringProp(false, "Deadline string"),
        routingTargets: arrayProp(false, "Targets to notify or route to"),
      }),
      run: async (args, service) => service.createCoordinationIssue({
        projectId: readString(args.projectId, "projectId"),
        title: readString(args.title, "title"),
        type: readString(args.type, "type") as CoordinationType,
        sourceInput: readString(args.sourceInput, "sourceInput"),
        content: readOptionalObject(args.content),
        initiator: readOptionalString(args.initiator),
        affectedScope: readOptionalStringArray(args.affectedScope, "affectedScope"),
        requiredGates: readOptionalStringArray(args.requiredGates, "requiredGates"),
        assignees: readOptionalStringArray(args.assignees, "assignees"),
        summary: readOptionalString(args.summary),
        deadline: readOptionalString(args.deadline),
        routingTargets: readOptionalStringArray(args.routingTargets, "routingTargets"),
      }),
    },
    {
      name: "update_coordination_issue",
      description: "Update a coordination issue.",
      inputSchema: objectSchema({
        coordinationIssueId: stringProp(true, "Coordination issue id"),
        title: stringProp(false, "Issue title"),
        summary: stringProp(false, "Issue summary"),
        currentStatus: enumProp(false, "Coordination issue status", [...coordinationStatuses]),
        content: objectProp(false, "Structured issue payload"),
        requiredGates: arrayProp(false, "Human confirmation gates"),
        assignees: arrayProp(false, "Target owners"),
        deadline: stringProp(false, "Deadline string"),
        routingTargets: arrayProp(false, "Targets to notify or route to"),
        affectedScope: arrayProp(false, "Affected scopes"),
        sourceInput: stringProp(false, "Raw input that triggered the issue"),
      }),
      run: async (args, service) => service.updateCoordinationIssue({
        coordinationIssueId: readString(args.coordinationIssueId, "coordinationIssueId"),
        title: readOptionalString(args.title),
        summary: readOptionalString(args.summary),
        currentStatus: readOptionalString(args.currentStatus) as CoordinationStatus | undefined,
        content: readOptionalObject(args.content),
        requiredGates: readOptionalStringArray(args.requiredGates, "requiredGates"),
        assignees: readOptionalStringArray(args.assignees, "assignees"),
        deadline: readOptionalString(args.deadline),
        routingTargets: readOptionalStringArray(args.routingTargets, "routingTargets"),
        affectedScope: readOptionalStringArray(args.affectedScope, "affectedScope"),
        sourceInput: readOptionalString(args.sourceInput),
      }),
    },
    {
      name: "get_coordination_issue_logs",
      description: "List the event log for one coordination issue.",
      inputSchema: objectSchema({
        coordinationIssueId: stringProp(true, "Coordination issue id"),
      }),
      run: async (args, service) => ({
        events: await service.getCoordinationIssueLogs(readString(args.coordinationIssueId, "coordinationIssueId")),
      }),
    },
    {
      name: "get_status_snapshot",
      description: "Get a short status snapshot for one coordination issue.",
      inputSchema: objectSchema({
        coordinationIssueId: stringProp(true, "Coordination issue id"),
      }),
      run: async (args, service) => service.getCoordinationIssueSnapshot(readString(args.coordinationIssueId, "coordinationIssueId")),
    },
    {
      name: "create_hot_response_issue",
      description: "Create the hot-response coordination flow from loom+ v0.",
      inputSchema: objectSchema({
        projectId: stringProp(true, "Project id"),
        topic: stringProp(true, "Hot topic title"),
        sourceInput: stringProp(true, "Original user request"),
        initiator: stringProp(false, "Initiator id or label"),
        deadline: stringProp(false, "Deadline string"),
        contentOwner: stringProp(false, "Content owner"),
        designOwner: stringProp(false, "Design owner"),
        approver: stringProp(false, "Approver or final owner"),
        channels: arrayProp(false, "Group or DM routing targets"),
        outputs: arrayProp(false, "Requested deliverables"),
      }),
      run: async (args, service) => service.createHotResponseIssue({
        projectId: readString(args.projectId, "projectId"),
        topic: readString(args.topic, "topic"),
        sourceInput: readString(args.sourceInput, "sourceInput"),
        initiator: readOptionalString(args.initiator),
        deadline: readOptionalString(args.deadline),
        contentOwner: readOptionalString(args.contentOwner),
        designOwner: readOptionalString(args.designOwner),
        approver: readOptionalString(args.approver),
        channels: readOptionalStringArray(args.channels, "channels"),
        outputs: readOptionalStringArray(args.outputs, "outputs"),
      }),
    },
    {
      name: "create_meeting_followup_issue",
      description: "Create the meeting-followup coordination flow from loom+ v0.",
      inputSchema: objectSchema({
        projectId: stringProp(true, "Project id"),
        title: stringProp(true, "Meeting title"),
        sourceInput: stringProp(true, "Original meeting ingestion request"),
        initiator: stringProp(false, "Initiator id or label"),
        meetingLink: stringProp(false, "Meeting link"),
        summary: stringProp(false, "Meeting summary"),
        decisions: arrayProp(false, "Meeting decisions"),
        followups: arrayProp(false, "Meeting follow-up actions"),
        attendees: arrayProp(false, "People involved in the follow-up"),
        channels: arrayProp(false, "Group or DM routing targets"),
      }),
      run: async (args, service) => service.createMeetingFollowupIssue({
        projectId: readString(args.projectId, "projectId"),
        title: readString(args.title, "title"),
        sourceInput: readString(args.sourceInput, "sourceInput"),
        initiator: readOptionalString(args.initiator),
        meetingLink: readOptionalString(args.meetingLink),
        summary: readOptionalString(args.summary),
        decisions: readOptionalStringArray(args.decisions, "decisions"),
        followups: readOptionalStringArray(args.followups, "followups"),
        attendees: readOptionalStringArray(args.attendees, "attendees"),
        channels: readOptionalStringArray(args.channels, "channels"),
      }),
    },
  ];
}

function objectSchema(properties: Record<string, ToolProperty>) {
  return {
    type: "object" as const,
    properties,
  };
}

function stringProp(required: boolean, description: string): ToolProperty {
  return { type: "string", required, description };
}

function arrayProp(required: boolean, description: string): ToolProperty {
  return { type: "array", required, description };
}

function objectProp(required: boolean, description: string): ToolProperty {
  return { type: "object", required, description };
}

function enumProp(required: boolean, description: string, values: string[]): ToolProperty {
  return {
    type: `enum<${values.join("|")}>`,
    required,
    description,
  };
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("Expected string value");
  }
  return value.trim();
}

function readOptionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${field} entries must be strings`);
    }
    return item.trim();
  });
}

function readOptionalObject(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object value");
  }
  return value as Record<string, unknown>;
}
