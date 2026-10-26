import type { Prisma } from "@evflow/database";

/** Read the effective active value; scheduled/future versions must not affect current documents. */
export async function activePolicyValue(
  db: Prisma.TransactionClient,
  companyId: string,
  code: string,
) {
  const version = await db.policyVersion.findFirst({
    where: {
      policy: { companyId, code },
      state: "ACTIVE",
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }],
    },
    orderBy: { versionNo: "desc" },
    select: { valueSnapshot: true },
  });
  return version?.valueSnapshot ?? null;
}
