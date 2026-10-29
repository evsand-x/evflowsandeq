import "../packages/backend/node_modules/reflect-metadata";
import { prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { assertFictitiousCompany } from "./dev-company";
import { hashPassword } from "../packages/backend/src/identity/password";
import { AuditService } from "../packages/backend/src/common/audit.service";

/** Bootstrap only the local development demo login, without transaction fixtures. */
async function main() {
  assertDevelopmentSeed();
  const companyId = "00000000-0000-4000-8000-000000000001";
  const email = "demo.admin@evflow.local";
  const password = process.env.DEV_SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) throw new Error("DEV_SEED_ADMIN_PASSWORD_REQUIRED");
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  await assertFictitiousCompany(company.id);

  const audit = new AuditService();
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing && !existing.active) throw new Error("ACTIVE_DEMO_ACCOUNT_REQUIRED");
    const user =
      existing ??
      (await tx.user.create({
        data: { email, displayName: "Admin Demo", passwordHash: await hashPassword(password) },
      }));
    const previousMembership = await tx.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (previousMembership && !previousMembership.active)
      throw new Error("ACTIVE_DEMO_MEMBERSHIP_REQUIRED");
    const membership =
      previousMembership ??
      (await tx.companyMembership.create({ data: { companyId, userId: user.id } }));
    const adminRole = await tx.role.findUniqueOrThrow({
      where: { companyId_code: { companyId, code: "ADMIN_SYSTEM" } },
    });
    const previousAssignment = await tx.userRole.findUnique({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: adminRole.id } },
    });
    if (!previousAssignment) {
      await tx.userRole.create({
        data: { companyId, membershipId: membership.id, roleId: adminRole.id },
      });
    }
    if (!existing || !previousMembership || !previousAssignment) {
      await audit.recordWith(tx, {
        companyId,
        actorId: "00000000-0000-4000-8000-000000000002",
        action: "development_seed.demo_admin_bootstrapped",
        resourceType: "user",
        resourceId: user.id,
        metadata: { account_created: !existing, membership_created: !previousMembership },
      });
    }
    return !existing;
  });
  console.log(JSON.stringify({ email, account_created: created, password_disclosed: false }));
}

main().finally(() => prisma.$disconnect());
