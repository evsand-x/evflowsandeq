import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { parseServerEnv } from "@evflow/config/env";
import { AppModule } from "./app.module";
import { ProblemDetailsFilter } from "./problem-details.filter";
import type { NextFunction, Request, Response } from "express";
import { createAuthRateLimit } from "./auth-rate-limit";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Server } from "node:http";

async function bootstrap() {
  const environment = parseServerEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });
  app.useBodyParser("json", { limit: "3mb" });
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: environment.APP_ORIGINS, credentials: true });
  const authRateLimit = createAuthRateLimit(environment.REDIS_URL);
  app.use(["/api/v1/auth/login", "/api/v1/auth/refresh"], authRateLimit.middleware);
  app.enableShutdownHooks();
  (app.getHttpServer() as Server).on("close", () => void authRateLimit.close());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(environment.API_PORT, "0.0.0.0");
}

void bootstrap();
