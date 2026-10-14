import { resolve } from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  process.env.DATABASE_URL ??=
    environment.DATABASE_URL ??
    "postgresql://evflow:evflow-local-password@localhost:5432/evflow?schema=public";
  process.env.REDIS_URL ??= environment.REDIS_URL ?? "redis://localhost:6379";
  process.env.S3_ENDPOINT ??= environment.S3_ENDPOINT ?? "http://localhost:9000";
  process.env.S3_REGION ??= environment.S3_REGION ?? "ap-southeast-1";
  process.env.S3_ACCESS_KEY_ID ??= environment.S3_ACCESS_KEY_ID ?? "evflow-local";
  process.env.S3_SECRET_ACCESS_KEY ??= environment.S3_SECRET_ACCESS_KEY ?? "evflow-local-password";
  process.env.S3_BUCKET_PRIVATE ??= environment.S3_BUCKET_PRIVATE ?? "evflow-private";
  process.env.S3_FORCE_PATH_STYLE ??= environment.S3_FORCE_PATH_STYLE ?? "true";
  process.env.JWT_ACCESS_SECRET ??=
    environment.JWT_ACCESS_SECRET ?? "test-access-secret-at-least-thirty-two-characters";
  process.env.JWT_REFRESH_SECRET ??=
    environment.JWT_REFRESH_SECRET ?? "test-refresh-secret-at-least-thirty-two-characters";
  process.env.JWT_ISSUER ??= environment.JWT_ISSUER ?? "evflow-test";
  process.env.JWT_AUDIENCE ??= environment.JWT_AUDIENCE ?? "evflow-tests";
  process.env.ACCESS_TOKEN_TTL_SECONDS ??= "900";
  process.env.REFRESH_TOKEN_TTL_DAYS ??= "30";
  process.env.APP_ORIGINS ??= "http://localhost:3000,http://localhost:3002";

  return {
    resolve: {
      alias: {
        "@evflow/backend": resolve(process.cwd(), "packages/backend/src/index.ts"),
        "@evflow/config/env": resolve(process.cwd(), "packages/config/src/env.ts"),
        "@evflow/contracts": resolve(process.cwd(), "packages/contracts/src/index.ts"),
        "@evflow/database": resolve(process.cwd(), "packages/database/src/index.ts"),
      },
    },
    test: {
      environment: "node",
      globals: true,
      include: ["apps/**/*.test.ts", "packages/**/*.test.ts", "tests/**/*.test.ts"],
      testTimeout: 30_000,
      hookTimeout: 30_000,
      sequence: { concurrent: false },
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
      },
    },
  };
});
