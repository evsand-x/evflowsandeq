import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { parseServerEnv } from "@evflow/config/env";
import type { HealthResponse } from "@evflow/contracts";
import { prisma } from "@evflow/database";
import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly environment = parseServerEnv(process.env);
  private readonly redis = new Redis(this.environment.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  private readonly s3 = new S3Client({
    region: this.environment.S3_REGION,
    endpoint: this.environment.S3_ENDPOINT,
    forcePathStyle: this.environment.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: this.environment.S3_ACCESS_KEY_ID,
      secretAccessKey: this.environment.S3_SECRET_ACCESS_KEY,
    },
  });

  async check(): Promise<HealthResponse> {
    const [database, redis, objectStorage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkObjectStorage(),
    ]);
    const isHealthy = [database, redis, objectStorage].every((status) => status === "up");

    return {
      status: isHealthy ? "ok" : "degraded",
      service: "evflow-api",
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        redis,
        object_storage: objectStorage,
      },
    };
  }

  async onModuleDestroy() {
    if (this.redis.status !== "end") {
      this.redis.disconnect();
    }
    this.s3.destroy();
  }

  private async checkDatabase(): Promise<"up" | "down"> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return "up";
    } catch {
      return "down";
    }
  }

  private async checkRedis(): Promise<"up" | "down"> {
    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }
      return (await this.redis.ping()) === "PONG" ? "up" : "down";
    } catch {
      return "down";
    }
  }

  private async checkObjectStorage(): Promise<"up" | "down"> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.environment.S3_BUCKET_PRIVATE }));
      return "up";
    } catch {
      return "down";
    }
  }
}
