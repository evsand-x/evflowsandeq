import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import process from "node:process";
const require = createRequire(import.meta.url);
import { spawnSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env"));
const cli = require.resolve("tsx/cli", { paths: [resolve(root, "packages/database")] });
const result = spawnSync(
  process.execPath,
  [
    cli,
    "--tsconfig",
    resolve(root, "packages/backend/tsconfig.json"),
    resolve(root, "tools/seed-full-development.ts"),
  ],
  { cwd: root, env: process.env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
