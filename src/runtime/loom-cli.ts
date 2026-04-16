import { spawn } from "node:child_process";

export type LoomCoordinationIssue = {
  coordinationIssueId?: string;
  id?: string;
  projectId?: string;
  title?: string;
  content?: Record<string, unknown>;
};

export type LoomMission = {
  missionId?: string;
  id?: string;
  projectId?: string;
  title?: string;
  deadline?: string;
  status?: string;
  assigneeId?: string;
  assigneeEmail?: string;
  assigneePlatform?: string;
  assigneePlatformId?: string;
};

type CommandResult = {
  stdout: string;
};

export type LoomCliRuntime = {
  listCoordinationIssues: () => Promise<LoomCoordinationIssue[]>;
  listMissions: (projectId: string) => Promise<LoomMission[]>;
};

export type LoomCliRuntimeOptions = {
  runCommand?: (command: string, args: string[]) => Promise<CommandResult>;
};

export function createLoomCliRuntime(options: LoomCliRuntimeOptions = {}): LoomCliRuntime {
  const runCommand = options.runCommand ?? runLoomCommand;

  return {
    listCoordinationIssues: async () => {
      const result = await runTool(runCommand, "list_coordination_issues", {});
      return readArrayField<LoomCoordinationIssue>(result, "coordinationIssues");
    },
    listMissions: async (projectId: string) => {
      const result = await runTool(runCommand, "list_missions", { projectId });
      return readArrayField<LoomMission>(result, "missions");
    },
  };
}

async function runTool(
  runCommand: (command: string, args: string[]) => Promise<CommandResult>,
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { stdout } = await runCommand("loom", ["run", tool, "--json", JSON.stringify(args)]);
  return parseJsonOutput(stdout);
}

function readArrayField<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object" && Array.isArray((value as Record<string, unknown>)[key])) {
    return (value as Record<string, unknown>)[key] as T[];
  }
  return [];
}

function parseJsonOutput(stdout: string): unknown {
  const text = String(stdout || "").trim();
  const starts = [...text.matchAll(/[\[{]/g)].map((match) => match.index ?? -1).filter((index) => index >= 0);
  for (const start of starts) {
    try {
      return JSON.parse(text.slice(start));
    } catch {
      continue;
    }
  }
  throw new Error("loom output did not contain JSON");
}

async function runLoomCommand(command: string, args: string[]): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolvePromise, rejectPromise) => {
    const stdoutChunks: Buffer[] = [];
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "inherit"],
    });

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => {
      rejectPromise(error);
    });
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout: Buffer.concat(stdoutChunks).toString("utf8") });
        return;
      }
      rejectPromise(new Error(`${command} exited with code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
  });
}
