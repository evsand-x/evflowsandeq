/** Explicit user-approved, company-scoped read access for local fixture review. */
import "../packages/backend/node_modules/reflect-metadata";
import { prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { AuditService } from "../packages/backend/src/common/audit.service";
import { AccessService } from "../packages/backend/src/identity/access.service";

async function main() {
  assertDevelopmentSeed();
  const companyId = "00000000-0000-4000-8000-000000000001";
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (!company.name.includes("DATA UJI FIKTIF")) throw new Error("FICTITIOUS_COMPANY_REQUIRED");
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "demo.admin@evflow.local" },
    select: { id: true, active: true },
  });
  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { companyId_userId: { companyId, userId: user.id } },
    include: { userRoles: true },
  });
  if (!user.active || !membership.active) throw new Error("ACTIVE_MEMBERSHIP_REQUIRED");
  const codes = [
    "warehouse.read",
    "finance.read",
    "fulfillment.read",
    "delivery_receipt.read",
    "sales_invoice.read",
    "customer_receipt.read",
    "posting_profile.read",
    "journal.read",
    "tax_rule.read",
    "tax_component.read",
    "bank_reconciliation.read",
  ];
  const permissions = await prisma.permission.findMany({ where: { code: { in: codes } } });
  if (permissions.length !== codes.length) throw new Error("REQUIRED_READ_PERMISSION_MISSING");
  const service = new AccessService(new AuditService());
  const code = "DEV_REVIEW_READ";
  const existing = await prisma.role.findUnique({
    where: { companyId_code: { companyId, code } },
    include: { rolePermissions: true },
  });
  const role =
    existing ??
    (await service.createRole(companyId, user.id, {
      code,
      name: "Review Data Uji — Baca",
      description:
        "Akses baca Warehouse/Finance disetujui pengguna pada 7 Oktober 2026, hanya perusahaan DATA UJI FIKTIF.",
    }));
  if (!role.active) throw new Error("REVIEW_ROLE_INACTIVE");
  const grants = permissions.map((p) => ({
    permission_id: p.id,
    scope_type: "company",
    scope_id: companyId,
  }));
  const current = existing?.rolePermissions ?? [];
  if (
    current.some(
      (g) =>
        g.scopeType !== "company" ||
        g.scopeId !== companyId ||
        !permissions.some((p) => p.id === g.permissionId),
    )
  )
    throw new Error("EXISTING_REVIEW_ROLE_CHANGED_MANUALLY");
  if (current.length !== grants.length)
    await service.updateRolePermissions(companyId, user.id, role.id, grants);
  if (!membership.userRoles.some((r) => r.roleId === role.id))
    await service.assignRoles(companyId, user.id, user.id, [
      ...membership.userRoles.map((r) => r.roleId),
      role.id,
    ]);
  const verified = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    include: { permission: true },
  });
  if (
    verified.length !== codes.length ||
    verified.some(
      (g) =>
        !codes.includes(g.permission.code) || g.scopeType !== "company" || g.scopeId !== companyId,
    )
  )
    throw new Error("READ_ONLY_VERIFICATION_FAILED");
  console.log(
    JSON.stringify(
      {
        role: code,
        company: company.name,
        permissions: verified.map((g) => g.permission.code),
        write_permissions_added: 0,
        sign_in_required_after_access_change: true,
      },
      null,
      2,
    ),
  );
}
main().finally(() => prisma.$disconnect());
