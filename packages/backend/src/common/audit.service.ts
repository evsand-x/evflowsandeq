import { createHash } from "node:crypto";
import { type Prisma, prisma } from "@evflow/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class AuditService {
  async record(input: {
    companyId: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.recordWith(prisma, input);
  }

  async recordWith(
    client: Pick<typeof prisma, "auditEvent">,
    input: {
      companyId: string;
      actorId: string;
      action: string;
      resourceType: string;
      resourceId?: string;
      before?: unknown;
      after?: unknown;
      reason?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return client.auditEvent.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        ...(input.resourceId ? { resourceId: input.resourceId } : {}),
        ...(input.before === undefined ? {} : { beforeHash: this.hash(input.before) }),
        ...(input.after === undefined ? {} : { afterHash: this.hash(input.after) }),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonObject } : {}),
      },
    });
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
