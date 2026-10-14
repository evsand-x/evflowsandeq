export function assertDevelopmentSeed(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "development" || env.EVFLOW_ALLOW_DEV_SEED !== "LOCAL_FICTITIOUS_ONLY")
    throw new Error("DEV_SEED_DISABLED: requires explicit local development opt-in");
  const db = new URL(env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) || db.pathname !== "/evflow")
    throw new Error("DEV_SEED_TARGET_REJECTED: only local evflow database is allowed");
  const storage = new URL(env.S3_ENDPOINT ?? "http://localhost:9000");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(storage.hostname))
    throw new Error("DEV_SEED_STORAGE_REJECTED");
}
