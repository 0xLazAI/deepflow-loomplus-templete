import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const helpersDir = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.resolve(helpersDir, "..");
const projectRoot = path.resolve(testDir, "..");

dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(testDir, "env.test"), override: true });

if (process.env.OPENAI_API_KEY) {
  process.env.CLAWCHEF_VAR_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}
if (process.env.ALLOWED_ORIGIN) {
  process.env.CLAWCHEF_VAR_ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
}
if (process.env.COORDINATOR_TELEGRAM_BOT_KEY) {
  process.env.CLAWCHEF_VAR_COORDINATOR_TELEGRAM_BOT_KEY = process.env.COORDINATOR_TELEGRAM_BOT_KEY;
}
