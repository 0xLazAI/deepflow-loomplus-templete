import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const requiredDeployEnvKeys = [
  "CLAWCHEF_VAR_COORDINATOR_TELEGRAM_BOT_KEY",
  "LOOM_TOKEN",
  "CLAWCHEF_VAR_OPENAI_API_KEY",
  "CLAWCHEF_VAR_ALLOWED_ORIGIN",
  "DOCS_AUTH_TOKEN",
];

describe("deploy owner configuration", () => {
  test("DigitalOcean deploy template exists and prompts for required env vars", async () => {
    const templatePath = path.join(projectRoot, ".do", "deploy.template.yaml");
    await access(templatePath);
    const template = await readFile(templatePath, "utf8");

    expect(template).toContain("0xLazAI/deepflow-loomplus-templete");
    expect(template).toContain("Dockerfile");
    for (const key of requiredDeployEnvKeys) {
      expect(template).toContain(key);
    }
  });

  test("Docker build does not require a GitHub token for public dependencies", async () => {
    const dockerfile = await readFile(path.join(projectRoot, "Dockerfile"), "utf8");

    expect(dockerfile).not.toContain("ARG GITHUB_TOKEN");
    expect(dockerfile).not.toContain("x-access-token");
    expect(dockerfile).toContain("https://github.com/0xLazAI/loomcli.git");
  });

  test("Docker build context excludes local secrets and git metadata", async () => {
    const dockerignore = await readFile(path.join(projectRoot, ".dockerignore"), "utf8");

    expect(dockerignore).toContain(".env");
    expect(dockerignore).toContain(".env.*");
    expect(dockerignore).toContain(".git");
    expect(dockerignore).toContain("deepflow-loomplus-config.yaml");
  });
});
