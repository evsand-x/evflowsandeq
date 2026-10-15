import "../packages/backend/node_modules/reflect-metadata";
import { prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { hashPassword } from "../packages/backend/src/identity/password";
import { AuditService } from "../packages/backend/src/common/audit.service";

async function main() {
  assertDevelopmentSeed();
  const companyId = "00000000-0000-4000-8000-000000000001";
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo.admin@evflow.local" } });
  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { companyId_userId: { companyId, userId: user.id } },
  });
  if (!user.active || !membership.active) throw new Error("ACTIVE_DEMO_ACCOUNT_REQUIRED");
  const password = process.env.DEV_DEMO_RESET_PASSWORD;
  if (!password) throw new Error("DEV_DEMO_RESET_PASSWORD_REQUIRED");
  const passwordHash = await hashPassword(password);
  const audit = new AuditService();
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordUpdatedAt: new Date() },
    });
    await transaction.authSession.updateMany({
      where: { membershipId: membership.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "password_reset" },
    });
    await audit.recordWith(transaction, {
      companyId,
      actorId: user.id,
      action: "user.password_reset",
      resourceType: "user",
      resourceId: user.id,
      metadata: { reason: "explicit_development_account_reset" },
    });
  });
  console.log(JSON.stringify({ email: user.email, password_reset: true, sessions_revoked: true }));
}
main().finally(() => prisma.$disconnect());
