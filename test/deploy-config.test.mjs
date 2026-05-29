import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const deployEnvKeys = [
  "COORDINATOR_TELEGRAM_BOT_KEY",
  "GOOGLE_MEETING_TELEGRAM_BOT_KEY",
  "PROJECT_MANAGER_TELEGRAM_BOT_KEY",
  "KNOWLEDGE_MANAGER_TELEGRAM_BOT_KEY",
  "LOOM_TOKEN",
  "OPENAI_API_KEY",
  "ALLOWED_ORIGIN",
  "DOCS_AUTH_TOKEN",
];

describe("deploy owner configuration", () => {
  test("DigitalOcean deploy template exists and prompts for required env vars", async () => {
    const templatePath = path.join(projectRoot, ".do", "deploy.template.yaml");
    await access(templatePath);
    const template = await readFile(templatePath, "utf8");

    expect(template).toContain("0xLazAI/deepflow-loomplus-templete");
    expect(template).toContain("Dockerfile");
    for (const key of deployEnvKeys) {
      expect(template).toContain(key);
    }
    expect(template).not.toContain("CLAWCHEF_VAR_");
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

  test("coordinator Telegram account accepts direct chats after one-click deploy", async () => {
    const recipe = await readFile(path.join(projectRoot, "recipe.yaml"), "utf8");

    expect(recipe).toContain('dmPolicy: "open"');
    expect(recipe).toContain("allowFrom:");
    expect(recipe).toContain('- "*"');
  });

  test("google meeting agent is configured beside coordinator", async () => {
    const recipe = await readFile(path.join(projectRoot, "recipe.yaml"), "utf8");
    const agentGuide = await readFile(path.join(projectRoot, "assets", "google-meeting", "AGENTS.md"), "utf8");
    const toolsGuide = await readFile(path.join(projectRoot, "assets", "google-meeting", "TOOLS.md"), "utf8");

    expect(recipe).toContain('google_meeting_telegram_bot_key');
    expect(recipe).toContain('name: "google-meeting"');
    expect(recipe).toContain('agent: "google-meeting"');
    expect(agentGuide).toContain("Google Meeting Agent");
    expect(toolsGuide).toContain("create_google_meeting");
    expect(toolsGuide).toContain("update_google_meeting_by_link");
    expect(toolsGuide).toContain("delete_google_meeting_by_link");
    expect(toolsGuide).toContain("scheduling_create_session");
    expect(toolsGuide).toContain("list_upcoming_meetings");
    expect(toolsGuide).toContain("get_user_email_by_platform_id");
    expect(toolsGuide).toContain("get_user_emails_by_ids");
  });

  test("project manager agent is configured beside coordinator", async () => {
    const recipe = await readFile(path.join(projectRoot, "recipe.yaml"), "utf8");
    const agentGuide = await readFile(path.join(projectRoot, "assets", "project-manager", "AGENTS.md"), "utf8");
    const toolsGuide = await readFile(path.join(projectRoot, "assets", "project-manager", "TOOLS.md"), "utf8");

    expect(recipe).toContain("project_manager_telegram_bot_key");
    expect(recipe).toContain('name: "project-manager"');
    expect(recipe).toContain('agent: "project-manager"');
    expect(agentGuide).toContain("Project Manager Agent");
    expect(agentGuide).toContain("create a project when no matching project exists");
    expect(toolsGuide).toContain("list_projects");
    expect(toolsGuide).toContain("get_project_id_by_name");
    expect(toolsGuide).toContain("create_project");
    expect(toolsGuide).toContain("update_project");
    expect(toolsGuide).toContain("update_project_status");
    expect(toolsGuide).toContain("delete_project");
    expect(toolsGuide).toContain("list_project_members");
    expect(toolsGuide).toContain("list_missions");
    expect(toolsGuide).toContain("get_mission");
    expect(toolsGuide).toContain("create_mission_by_project_name");
    expect(toolsGuide).toContain("list_missions_by_deadline");
    expect(toolsGuide).toContain("update_mission");
    expect(toolsGuide).toContain("delete_mission");
    expect(toolsGuide).toContain("get_mission_logs");
  });

  test("knowledge manager agent is configured beside coordinator", async () => {
    const recipe = await readFile(path.join(projectRoot, "recipe.yaml"), "utf8");
    const agentGuide = await readFile(path.join(projectRoot, "assets", "knowledge-manager", "AGENTS.md"), "utf8");
    const toolsGuide = await readFile(path.join(projectRoot, "assets", "knowledge-manager", "TOOLS.md"), "utf8");

    expect(recipe).toContain("knowledge_manager_telegram_bot_key");
    expect(recipe).toContain('name: "knowledge-manager"');
    expect(recipe).toContain('agent: "knowledge-manager"');
    expect(agentGuide).toContain("Knowledge Manager Agent");
    expect(agentGuide).toContain("team wiki memory");
    expect(toolsGuide).toContain("list_knowledge_bases");
    expect(toolsGuide).toContain("get_knowledge_base_id");
    expect(toolsGuide).toContain("create_knowledge_base");
    expect(toolsGuide).toContain("update_knowledge_base_name");
    expect(toolsGuide).toContain("upsert_document");
    expect(toolsGuide).toContain("list_documents");
    expect(toolsGuide).toContain("delete_document");
    expect(toolsGuide).toContain("ask_knowledge_base");
    expect(toolsGuide).toContain("ask_all_knowledge_bases");
  });
});
