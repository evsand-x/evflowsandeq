import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");
const commaSeparated = z.string().transform((value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(8),
  S3_BUCKET_PRIVATE: z.string().min(3),
  S3_FORCE_PATH_STYLE: booleanString.default("true"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default("evflow-local"),
  JWT_AUDIENCE: z.string().min(1).default("evflow-apps"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  APP_ORIGINS: commaSeparated.default("http://localhost:3000,http://localhost:3002"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(environment: NodeJS.ProcessEnv): ServerEnv {
  const result = serverEnvSchema.safeParse(environment);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  return result.data;
}
