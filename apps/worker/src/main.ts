import "reflect-metadata";
import { parseServerEnv } from "@evflow/config/env";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  parseServerEnv(process.env);
  const application = await NestFactory.createApplicationContext(WorkerModule);
  application.enableShutdownHooks();
}

void bootstrap();
