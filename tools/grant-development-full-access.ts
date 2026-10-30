import "../packages/backend/node_modules/reflect-metadata";
import { prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { assertFictitiousCompany } from "./dev-company";
import { AuditService } from "../packages/backend/src/common/audit.service";
import { AccessService } from "../packages/backend/src/identity/access.service";

async function main() {
  assertDevelopmentSeed();
  const companyId = "00000000-0000-4000-8000-000000000001";
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  await assertFictitiousCompany(company.id);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo.admin@evflow.local" } });
  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { companyId_userId: { companyId, userId: user.id } },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user.active || !membership.active) throw new Error("ACTIVE_DEMO_ACCOUNT_REQUIRED");
  if (!membership.userRoles.some(({ role }) => role.code === "ADMIN_SYSTEM" && role.active))
    throw new Error("EXISTING_ADMIN_ROLE_REQUIRED");
  const audit = new AuditService();
  const access = new AccessService(audit);
  const code = "DEV_DEMO_FULL_ACCESS";
  let role = await prisma.role.findUnique({ where: { companyId_code: { companyId, code } } });
  if (!role)
    role = await access.createRole(companyId, user.id, {
      code,
      name: "Akses Penuh Admin Demo — DATA UJI FIKTIF",
      description:
        "Seluruh permission terdaftar, khusus demo.admin@evflow.local; permintaan pengguna 15 Oktober 2026.",
    });
  if (!role.active) throw new Error("DEMO_ROLE_INACTIVE");
  if (
    await prisma.userRole.count({
      where: { roleId: role.id, membershipId: { not: membership.id } },
    })
  )
    throw new Error("DEMO_ROLE_MUST_NOT_BE_SHARED");
  const permissions = await prisma.permission.findMany({ orderBy: { code: "asc" } });
  if (!permissions.some((p) => p.code === "sales_invoice.post"))
    throw new Error("INVOICE_PERMISSION_MISSING");
  const grants = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
  if (
    grants.length !== permissions.length ||
    permissions.some(
      (p) =>
        !grants.some(
          (g) => g.permissionId === p.id && g.scopeType === "company" && g.scopeId === companyId,
        ),
    )
  ) {
    await access.updateRolePermissions(
      companyId,
      user.id,
      role.id,
      permissions.map((p) => ({
        permission_id: p.id,
        scope_type: "company",
        scope_id: companyId,
      })),
    );
  }
  if (!membership.userRoles.some((r) => r.roleId === role.id))
    await access.assignRoles(companyId, user.id, user.id, [
      ...membership.userRoles.map((r) => r.roleId),
      role.id,
    ]);
  const account = (await access.listUsers(companyId)).find((u) => u.user_id === user.id)!;
  const missing = permissions.filter(
    (p) =>
      !account.effective_permissions.some(
        (g) =>
          g.code === p.code &&
          g.scope_type === "company" &&
          (g.scope_id === companyId || g.scope_id === null),
      ),
  );
  if (missing.length)
    throw new Error(`MISSING_PERMISSIONS: ${missing.map((p) => p.code).join(",")}`);
  console.log(
    JSON.stringify({
      email: user.email,
      company: company.name,
      permissions: permissions.length,
      missing: missing.length,
      invoicePost: true,
      role: code,
    }),
  );
}
main().finally(() => prisma.$disconnect());
