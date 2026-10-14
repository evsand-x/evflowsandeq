export interface ServerEnv {
  NODE_ENV: "development" | "test" | "production";
  API_PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_BUCKET_PRIVATE: string;
  S3_FORCE_PATH_STYLE: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  ACCESS_TOKEN_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_DAYS: number;
  APP_ORIGINS: string[];
}

export function parseServerEnv(environment: NodeJS.ProcessEnv): ServerEnv;
