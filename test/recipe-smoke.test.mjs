import { test, expect } from "@jest/globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

test("recipe scaffold files exist", async () => {
  console.log("[recipe-smoke] checking scaffold files");
  await access(path.join(projectRoot, "recipe.yaml"));
  await access(path.join(projectRoot, "package.json"));
  expect(true).toBe(true);
});
