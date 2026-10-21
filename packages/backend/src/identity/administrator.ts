import type { Prisma } from "@evflow/database";

/** The reserved role grants company-wide authority without editable role grants. */
export async function isCompanyAdministrator(
  tx: Prisma.TransactionClient,
  companyId: string,
  userId: string,
) {
  return Boolean(
    await tx.companyMembership.findFirst({
      where: {
        companyId,
        userId,
        active: true,
        deletedAt: null,
        user: { active: true },
        userRoles: { some: { role: { companyId, code: "ADMIN_SYSTEM", active: true } } },
      },
      select: { id: true },
    }),
  );
}
