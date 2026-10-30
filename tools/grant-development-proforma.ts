/** User-authorized 7 October 2026: add only proforma.issue to the existing dev SO role. */
import "../packages/backend/node_modules/reflect-metadata";
import { prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { assertFictitiousCompany } from "./dev-company";
import { AccessService } from "../packages/backend/dist/identity/access.service";
import { AuditService } from "../packages/backend/dist/common/audit.service";

async function main() {
  assertDevelopmentSeed();
  const companyId = "00000000-0000-4000-8000-000000000001";
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  await assertFictitiousCompany(company.id);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo.admin@evflow.local" } });
  const role = await prisma.role.findUniqueOrThrow({
    where: { companyId_code: { companyId, code: "DEV_SALES_ORDER" } },
    include: { rolePermissions: true, userRoles: { include: { membership: true } } },
  });
  if (
    !user.active ||
    !role.active ||
    role.name !== "Sales Order — DATA UJI DEV" ||
    !role.userRoles.some((r) => r.membership.userId === user.id && r.membership.active)
  )
    throw new Error("AUTHORIZED_DEVELOPMENT_ROLE_REQUIRED");
  const permission = await prisma.permission.findUniqueOrThrow({
    where: { code: "proforma.issue" },
  });
  if (
    !role.rolePermissions.some(
      (p) =>
        p.permissionId === permission.id && p.scopeType === "company" && p.scopeId === companyId,
    )
  ) {
    await new AccessService(new AuditService()).updateRolePermissions(companyId, user.id, role.id, [
      ...role.rolePermissions.map((p) => ({
        permission_id: p.permissionId,
        scope_type: p.scopeType,
        scope_id: p.scopeId,
      })),
      { permission_id: permission.id, scope_type: "company", scope_id: companyId },
    ]);
  }
  console.log(
    JSON.stringify({
      role: role.name,
      added_permission: "proforma.issue",
      scope: "local fictitious company",
      sign_in_required: true,
    }),
  );
}
main().finally(() => prisma.$disconnect());
