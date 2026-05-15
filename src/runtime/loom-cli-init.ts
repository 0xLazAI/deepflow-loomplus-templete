import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type Logger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

type CommandResult = {
  stdout: string;
};

export type LoomCliInitOptions = {
  loomServer?: string;
  loomToken?: string;
  outputPath?: string;
  runCommand?: (command: string, args: string[]) => Promise<CommandResult>;
  logger?: Logger;
};

const defaultOutputPath = "/tmp/deepflow-assets/loom-tools.md";

export async function initializeLoomCli(options: LoomCliInitOptions = {}): Promise<void> {
  const loomServer =
    options.loomServer?.trim() ??
    process.env.LOOM_SERVER?.trim() ??
    process.env.NEXTAUTH_URL?.trim() ??
    process.env.CLAWCHEF_VAR_ALLOWED_ORIGIN?.trim() ??
    "";
  const loomToken = options.loomToken?.trim() ?? process.env.LOOM_TOKEN?.trim() ?? "";
  const outputPath = options.outputPath ?? defaultOutputPath;
  const runCommand = options.runCommand ?? runLoomCommand;
  const logger = options.logger ?? defaultLogger;

  if (!loomServer) {
    throw new Error("LOOM_SERVER, NEXTAUTH_URL, or CLAWCHEF_VAR_ALLOWED_ORIGIN is required to initialize loomcli");
  }
  if (!loomToken) {
    throw new Error("LOOM_TOKEN is required to initialize loomcli");
  }

  logger.info(`[loomcli] logging in to ${loomServer}`);
  await runCommand("loom", ["login", "--server", loomServer, "--token", loomToken]);

  logger.info("[loomcli] listing tools");
  const { stdout } = await runCommand("loom", ["list"]);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, stdout, "utf8");
  logger.info(`[loomcli] wrote tool list to ${outputPath}`);
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

const defaultLogger: Logger = {
  info: (message) => {
    console.log(message);
  },
  error: (message) => {
    console.error(message);
  },
};
