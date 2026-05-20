import { execSync } from "child_process";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

export default function globalSetup() {
  const webRoot = resolve(__dirname, "..");
  loadEnvFile(resolve(webRoot, ".env.local"));
  loadEnvFile(resolve(webRoot, ".env"));

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for API tests. Set it in .env.local or as env var.",
    );
  }

  if (process.env.CI || !process.env.DRIZZLE_PUSH) {
    return;
  }

  execSync("echo y | pnpm drizzle-kit push", {
    cwd: webRoot,
    stdio: "inherit",
    shell: "/bin/bash",
  });
}
