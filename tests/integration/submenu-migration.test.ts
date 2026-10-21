import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";

describe("submenu permission migration", () => {
  it("preserves scopes, audits mappings, leaves empty roles empty and retains admin sessions", async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname))
      throw new Error("Local test database required");
    const rollback = new Error("rollback migration test");
    const sql = readFileSync(
      "packages/database/prisma/migrations/20261016210000_independent_submenu_permissions/migration.sql",
      "utf8",
    );
    let assertionsCompleted = false;
    try {
      await prisma.$transaction(
        async (tx) => {
          const company = await tx.company.create({
            data: { name: `Migration test ${randomUUID()}` },
          });
          const role = await tx.role.create({
            data: { companyId: company.id, code: "TEST", name: "Legacy" },
          });
          const empty = await tx.role.create({
            data: { companyId: company.id, code: "EMPTY", name: "Empty" },
          });
          const admin = await tx.role.create({
            data: { companyId: company.id, code: "ADMIN_SYSTEM", name: "Admin" },
          });
          const old = await tx.permission.upsert({
            where: { code: "crm.read" },
            update: {},
            create: { code: "crm.read", resource: "crm", action: "read" },
          });
          const scopeId = randomUUID();
          await tx.rolePermission.createMany({
            data: [
              {
                companyId: company.id,
                roleId: role.id,
                permissionId: old.id,
                scopeType: "company",
              },
              {
                companyId: company.id,
                roleId: role.id,
                permissionId: old.id,
                scopeType: "warehouse",
                scopeId,
              },
            ],
          });
          const sessionIds: string[] = [];
          for (const isAdmin of [false, true]) {
            const user = await tx.user.create({
              data: {
                email: `migration-${randomUUID()}@example.invalid`,
                displayName: "Test",
                passwordHash: "DISABLED_TEST_ACCOUNT",
              },
            });
            const member = await tx.companyMembership.create({
              data: { companyId: company.id, userId: user.id },
            });
            await tx.userRole.create({
              data: { companyId: company.id, membershipId: member.id, roleId: role.id },
            });
            if (isAdmin)
              await tx.userRole.create({
                data: { companyId: company.id, membershipId: member.id, roleId: admin.id },
              });
            const session = await tx.authSession.create({
              data: {
                companyId: company.id,
                membershipId: member.id,
                sessionFamilyId: randomUUID(),
                expiresAt: new Date(Date.now() + 60000),
              },
            });
            sessionIds.push(session.id);
          }
          for (const statement of sql
            .replace(/^--.*$/gm, "")
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s && s !== "BEGIN" && s !== "COMMIT"))
            await tx.$executeRawUnsafe(statement);
          const grants = await tx.rolePermission.findMany({
            where: { roleId: role.id },
            include: { permission: true },
          });
          expect(
            grants
              .filter((g) => g.permission.code === "crm_contact.read")
              .map((g) => [g.scopeType, g.scopeId]),
          ).toEqual(
            expect.arrayContaining([
              ["company", null],
              ["warehouse", scopeId],
            ]),
          );
          expect(grants.some((g) => g.permission.code === "crm_prospect.read")).toBe(true);
          expect(grants.every((g) => g.permission.action === "read")).toBe(true);
          expect(await tx.permission.findUnique({ where: { code: "crm.read" } })).toBeNull();
          expect(await tx.rolePermission.count({ where: { roleId: empty.id } })).toBe(0);
          expect(
            await tx.auditEvent.count({
              where: {
                companyId: company.id,
                resourceId: role.id,
                action: "role.permissions.migrated",
                actorId: null,
              },
            }),
          ).toBe(1);
          expect(
            (await tx.authSession.findUniqueOrThrow({ where: { id: sessionIds[0] } })).revokedAt,
          ).not.toBeNull();
          expect(
            (await tx.authSession.findUniqueOrThrow({ where: { id: sessionIds[1] } })).revokedAt,
          ).toBeNull();
          assertionsCompleted = true;
          throw rollback;
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
    expect(assertionsCompleted).toBe(true);
  });
});
