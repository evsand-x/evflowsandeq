import { parseServerEnv } from "@evflow/config/env";
import { activateDuePolicyVersions, prisma } from "@evflow/database";
import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { processExceptionEvaluations, processReservationExpiries } from "@evflow/backend";

@Injectable()
export class FoundationWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private policyActivationTimer?: NodeJS.Timeout;

  async onModuleInit() {
    const environment = parseServerEnv(process.env);
    this.worker = new Worker(
      "evflow-foundation",
      async (job) => ({ event_id: job.id, handled: true }),
      { connection: { url: environment.REDIS_URL } },
    );
    await activateDuePolicyVersions(prisma);
    await processExceptionEvaluations();
    await processReservationExpiries();
    this.policyActivationTimer = setInterval(() => {
      void processReservationExpiries().catch(() =>
        Logger.error("Reservation expiry polling failed", "FoundationWorker"),
      );
      void activateDuePolicyVersions(prisma);
      void processExceptionEvaluations().catch(() =>
        Logger.error("Sales exception evaluation polling failed", "FoundationWorker"),
      );
    }, 60_000);
    this.policyActivationTimer.unref();
  }

  async onModuleDestroy() {
    if (this.policyActivationTimer) clearInterval(this.policyActivationTimer);
    await this.worker?.close();
  }
}
