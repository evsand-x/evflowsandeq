/** Read-only verification of the local submenu migration. */
import { prisma } from "../packages/database/src";

async function main() {
  if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const legacy = await prisma.permission.count({
    where: { OR: [{ resource: "crm" }, { resource: "master_data" }, { code: "fulfillment.read" }] },
  });
  const audit = await prisma.auditEvent.count({
    where: {
      action: "role.permissions.migrated",
      metadata: { path: ["migration"], equals: "20261016210000_independent_submenu_permissions" },
    },
  });
  const children = await prisma.permission.count({
    where: {
      OR: [
        { resource: { startsWith: "crm_" } },
        { resource: { startsWith: "master_" } },
        { resource: { startsWith: "outbound_" } },
      ],
    },
  });
  console.log(
    JSON.stringify({
      retired_permissions_remaining: legacy,
      child_permissions: children,
      migration_audit_events: audit,
    }),
  );
  if (legacy) throw new Error("Retired permissions remain in catalog");
}
main().finally(() => prisma.$disconnect());
