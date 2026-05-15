import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("loom cli startup initialization", () => {
  let runtimeRoot;
  let initializeLoomCli;

  beforeEach(async () => {
    runtimeRoot = await mkdtemp(path.join(tmpdir(), "loom-cli-init-"));
    ({ initializeLoomCli } = await import("../dist/runtime/loom-cli-init.js"));
  });

  afterEach(async () => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.CLAWCHEF_VAR_ALLOWED_ORIGIN;
    if (runtimeRoot) {
      await rm(runtimeRoot, { recursive: true, force: true });
    }
  });

  test("logs in and writes loom list output to file", async () => {
    const calls = [];
    const outputPath = path.join(runtimeRoot, "loom-tools.md");

    await initializeLoomCli({
      loomServer: "https://loom.example.com",
      loomToken: "secret-token",
      outputPath,
      runCommand: async (command, args) => {
        calls.push({ command, args });
        if (args[0] === "list") {
          return { stdout: "# Loom Tools\n- list_projects\n" };
        }
        return { stdout: "" };
      },
      logger: {
        info: () => {},
        error: () => {},
      },
    });

    expect(calls).toEqual([
      {
        command: "loom",
        args: ["login", "--server", "https://loom.example.com", "--token", "secret-token"],
      },
      {
        command: "loom",
        args: ["list"],
      },
    ]);
    await expect(readFile(outputPath, "utf8")).resolves.toBe("# Loom Tools\n- list_projects\n");
  });

  test("fails fast when credentials are missing", async () => {
    await expect(
      initializeLoomCli({
        loomServer: "",
        loomToken: "",
        logger: {
          info: () => {},
          error: () => {},
        },
      }),
    ).rejects.toThrow("LOOM_SERVER, NEXTAUTH_URL, or CLAWCHEF_VAR_ALLOWED_ORIGIN is required");
  });

  test("uses NEXTAUTH_URL as the Loom server fallback", async () => {
    const calls = [];
    process.env.NEXTAUTH_URL = "https://loom.example.com";

    await initializeLoomCli({
      loomToken: "secret-token",
      outputPath: path.join(runtimeRoot, "loom-tools.md"),
      runCommand: async (command, args) => {
        calls.push({ command, args });
        return { stdout: "" };
      },
      logger: {
        info: () => {},
        error: () => {},
      },
    });

    expect(calls[0]).toEqual({
      command: "loom",
      args: ["login", "--server", "https://loom.example.com", "--token", "secret-token"],
    });
  });

  test("uses CLAWCHEF_VAR_ALLOWED_ORIGIN as the Loom server fallback", async () => {
    const calls = [];
    process.env.CLAWCHEF_VAR_ALLOWED_ORIGIN = "https://loom.example.com";

    await initializeLoomCli({
      loomToken: "secret-token",
      outputPath: path.join(runtimeRoot, "loom-tools.md"),
      runCommand: async (command, args) => {
        calls.push({ command, args });
        return { stdout: "" };
      },
      logger: {
        info: () => {},
        error: () => {},
      },
    });

    expect(calls[0]).toEqual({
      command: "loom",
      args: ["login", "--server", "https://loom.example.com", "--token", "secret-token"],
    });
  });

  test("propagates loom login failure and does not write output file", async () => {
    const outputPath = path.join(runtimeRoot, "loom-tools.md");

    await expect(
      initializeLoomCli({
        loomServer: "https://loom.example.com",
        loomToken: "secret-token",
        outputPath,
        runCommand: async (_command, args) => {
          if (args[0] === "login") {
            throw new Error("loom login failed");
          }
          return { stdout: "unexpected" };
        },
        logger: {
          info: () => {},
          error: () => {},
        },
      }),
    ).rejects.toThrow("loom login failed");

    await expect(readFile(outputPath, "utf8")).rejects.toThrow();
  });
});
