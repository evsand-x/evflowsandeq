import type { Prisma, PrismaClient } from "@prisma/client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface ActivatePolicyVersionInput {
  policyId: string;
  valueSnapshot: Prisma.InputJsonValue;
  savedById: string;
  effectiveFrom?: Date;
  reason?: string;
  approvalReference?: string;
  expectedVersion?: number;
}

export class PolicyVersionConflictError extends Error {}

export async function activatePolicyVersion(
  client: PrismaClient,
  input: ActivatePolicyVersionInput,
) {
  return client.$transaction((transaction) =>
    activatePolicyVersionInTransaction(transaction, input),
  );
}

export async function activatePolicyVersionInTransaction(
  transaction: Prisma.TransactionClient,
  input: ActivatePolicyVersionInput,
) {
  await transaction.$queryRaw`SELECT id FROM system_policies WHERE id = ${input.policyId}::uuid FOR UPDATE`;

  const latest = await transaction.policyVersion.aggregate({
    where: { policyId: input.policyId },
    _max: { versionNo: true },
  });

  if (
    input.expectedVersion !== undefined &&
    (latest._max.versionNo ?? 0) !== input.expectedVersion
  ) {
    throw new PolicyVersionConflictError("Policy version changed");
  }

  const scheduled = Boolean(input.effectiveFrom && input.effectiveFrom > new Date());
  if (!scheduled) {
    await transaction.policyVersion.updateMany({
      where: { policyId: input.policyId, state: "ACTIVE" },
      data: { state: "RETIRED", retiredAt: new Date() },
    });
  }

  return createVersion(
    transaction,
    input,
    (latest._max.versionNo ?? 0) + 1,
    scheduled ? "SCHEDULED" : "ACTIVE",
  );
}

export async function activateDuePolicyVersions(client: PrismaClient, now = new Date()) {
  const due = await client.policyVersion.findMany({
    where: { state: "SCHEDULED", effectiveFrom: { lte: now } },
    orderBy: [{ effectiveFrom: "asc" }, { versionNo: "asc" }],
    select: { id: true, policyId: true },
  });
  for (const candidate of due) {
    await client.$transaction(async (transaction) => {
      const policies = await transaction.$queryRaw<Array<{ company_id: string }>>`
        SELECT company_id FROM system_policies WHERE id = ${candidate.policyId}::uuid FOR UPDATE
      `;
      const version = await transaction.policyVersion.findUnique({ where: { id: candidate.id } });
      if (!version || version.state !== "SCHEDULED" || !version.effectiveFrom) return;
      await transaction.policyVersion.updateMany({
        where: { policyId: candidate.policyId, state: "ACTIVE" },
        data: { state: "RETIRED", retiredAt: now },
      });
      await transaction.policyVersion.update({
        where: { id: candidate.id },
        data: { state: "ACTIVE", retiredAt: null },
      });
      if (policies[0]) {
        await transaction.auditEvent.create({
          data: {
            companyId: policies[0].company_id,
            action: "operational_policy.scheduled_activated",
            resourceType: "system_policy",
            resourceId: candidate.policyId,
            metadata: { version_id: candidate.id, version_no: version.versionNo },
          },
        });
      }
    });
  }
  return due.length;
}

function createVersion(
  client: DatabaseClient,
  input: ActivatePolicyVersionInput,
  versionNo: number,
  state: "ACTIVE" | "SCHEDULED",
) {
  return client.policyVersion.create({
    data: {
      policyId: input.policyId,
      versionNo,
      valueSnapshot: input.valueSnapshot,
      savedById: input.savedById,
      ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.approvalReference ? { approvalReference: input.approvalReference } : {}),
      state,
    },
  });
}
