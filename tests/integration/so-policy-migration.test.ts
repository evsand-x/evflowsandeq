import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";

it("seeds editable SO defaults once without replacing an existing choice", async () => {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database only");
  const rollback = new Error("rollback SO policy migration");
  const sql = readFileSync(
    "packages/database/prisma/migrations/20261025110000_sales_order_policy_defaults/migration.sql",
    "utf8",
  );
  await prisma
    .$transaction(
      async (tx) => {
        const c = (await tx.company.create({ data: { name: "Migration test" } })).id;
        const a = (
          await tx.user.create({
            data: {
              email: `${randomUUID()}@test.invalid`,
              displayName: "Tester",
              passwordHash: "disabled",
            },
          })
        ).id;
        await tx.companyMembership.create({ data: { companyId: c, userId: a } });
        await tx.$executeRawUnsafe(sql);
        const policies = await tx.systemPolicy.findMany({
          where: { companyId: c },
          include: { versions: true },
        });
        expect(policies).toHaveLength(4);
        const required = policies.find((p) => p.code === "OPS-FLX-12")!;
        await tx.policyVersion.update({
          where: { id: required.versions[0]!.id },
          data: { valueSnapshot: true },
        });
        await tx.$executeRawUnsafe(sql);
        expect(
          (await tx.policyVersion.findUniqueOrThrow({ where: { id: required.versions[0]!.id } }))
            .valueSnapshot,
        ).toBe(true);
        expect(
          await tx.auditEvent.count({
            where: { companyId: c, action: "operational_policy.defaults_migrated" },
          }),
        ).toBe(4);
        throw rollback;
      },
      { timeout: 30000 },
    )
    .catch((e) => {
      if (e !== rollback) throw e;
    });
});
