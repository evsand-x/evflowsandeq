const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const root = resolve(__dirname, "..");
process.loadEnvFile(resolve(root, ".env"));
const cli = require.resolve("tsx/cli", { paths: [resolve(root, "packages/database")] });
for (const script of ["packages/database/prisma/seed.ts", "tools/seed-development.ts"]) {
  const result = spawnSync(
    process.execPath,
    [cli, "--tsconfig", resolve(root, "packages/backend/tsconfig.json"), resolve(root, script)],
    { cwd: root, env: process.env, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
