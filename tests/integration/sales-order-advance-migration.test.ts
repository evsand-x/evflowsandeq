import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@evflow/database";

test("advance migration copies only receipt-post grants with their scopes and audit", async () => {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const rollback = new Error("rollback migration fixture");
  const sql = readFileSync(
    "packages/database/prisma/migrations/20261025200000_sales_order_advance/migration.sql",
    "utf8",
  );
  await prisma
    .$transaction(
      async (tx) => {
        const c = (await tx.company.create({ data: { name: "Advance permission migration test" } }))
          .id;
        const receipt = await tx.permission.findUniqueOrThrow({
          where: { code: "customer_receipt.post" },
        });
        const read = await tx.permission.findUniqueOrThrow({ where: { code: "sales_order.read" } });
        const permitted = await tx.role.create({
          data: { companyId: c, code: randomUUID(), name: "Receipt poster" },
        });
        const denied = await tx.role.create({
          data: { companyId: c, code: randomUUID(), name: "SO reader" },
        });
        for (const [role, permission] of [
          [permitted, receipt],
          [denied, read],
        ] as const)
          await tx.rolePermission.create({
            data: {
              companyId: c,
              roleId: role.id,
              permissionId: permission.id,
              scopeType: "company",
              scopeId: c,
            },
          });
        await tx.$executeRawUnsafe(sql.slice(sql.indexOf("WITH granted AS")));
        const grants = await tx.rolePermission.findMany({
          where: { companyId: c, permission: { code: { startsWith: "sales_order_advance." } } },
          include: { permission: true },
        });
        expect(grants.map((g) => g.permission.code).sort()).toEqual([
          "sales_order_advance.create",
          "sales_order_advance.verify",
        ]);
        expect(
          grants.every(
            (g) => g.roleId === permitted.id && g.scopeType === "company" && g.scopeId === c,
          ),
        ).toBe(true);
        expect(
          await tx.auditEvent.count({
            where: { companyId: c, action: "permission.migrated", resourceId: permitted.id },
          }),
        ).toBe(2);
        throw rollback;
      },
      { timeout: 30000 },
    )
    .catch((e) => {
      if (e !== rollback) throw e;
    });
});
