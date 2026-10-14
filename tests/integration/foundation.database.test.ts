import { randomUUID } from "node:crypto";
import { activateDuePolicyVersions, activatePolicyVersion, prisma } from "@evflow/database";

describe("foundation database", () => {
  const companyId = randomUUID();
  const userId = randomUUID();
  let membershipId: string;
  let roleIds: string[] = [];
  let policyId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (policyId) {
      await prisma.policyVersion.deleteMany({ where: { policyId } });
      await prisma.systemPolicy.delete({ where: { id: policyId } });
    }
    if (membershipId) {
      await prisma.userRole.deleteMany({ where: { membershipId } });
    }
    if (roleIds.length > 0) {
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    }
    await prisma.companyMembership.deleteMany({ where: { companyId } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("connects to PostgreSQL", async () => {
    const rows = await prisma.$queryRaw<Array<{ connected: number }>>`SELECT 1 AS connected`;
    expect(rows[0]?.connected).toBe(1);
  });

  it("allows one membership to hold multiple distinct roles", async () => {
    await prisma.company.create({ data: { id: companyId, name: "Company Data Uji Fiktif" } });
    await prisma.user.create({
      data: {
        id: userId,
        email: `test-${userId}@evflow.local`,
        displayName: "Pengguna Uji Fiktif",
        passwordHash: "TEST_ACCOUNT_DISABLED_PASSWORD_HASH",
      },
    });
    const membership = await prisma.companyMembership.create({
      data: { companyId, userId },
    });
    membershipId = membership.id;
    const roles = await Promise.all(
      ["TEST_SALES", "TEST_FINANCE"].map((code) =>
        prisma.role.create({ data: { companyId, code, name: code } }),
      ),
    );
    roleIds = roles.map((role) => role.id);

    await prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ companyId, membershipId, roleId })),
    });

    const assignedRoles = await prisma.userRole.findMany({ where: { membershipId } });
    expect(assignedRoles).toHaveLength(2);
  });

  it("versions immediate and future-effective policies without activating early", async () => {
    const policy = await prisma.systemPolicy.create({
      data: {
        companyId,
        code: "TEST-FICTITIOUS-01",
        name: "Policy Data Uji Fiktif",
        ownerDomain: "Administration",
        policyGroup: "System",
        scope: "company",
        valueType: "object",
        validationSchema: { type: "object" },
        defaultValueSnapshot: { fictitious_test_data: true },
        allowsFutureEffective: true,
      },
    });
    policyId = policy.id;

    await activatePolicyVersion(prisma, {
      policyId,
      savedById: userId,
      valueSnapshot: { fictitious_test_data: true, revision: "first" },
    });
    await activatePolicyVersion(prisma, {
      policyId,
      savedById: userId,
      valueSnapshot: { fictitious_test_data: true, revision: "second" },
    });

    const futureEffective = new Date(Date.now() + 60_000);
    await activatePolicyVersion(prisma, {
      policyId,
      savedById: userId,
      valueSnapshot: { fictitious_test_data: true, revision: "scheduled" },
      effectiveFrom: futureEffective,
      expectedVersion: 2,
    });

    let versions = await prisma.policyVersion.findMany({
      where: { policyId },
      orderBy: { versionNo: "asc" },
    });
    expect(versions.map((version) => [version.versionNo, version.state])).toEqual([
      [1, "RETIRED"],
      [2, "ACTIVE"],
      [3, "SCHEDULED"],
    ]);

    await activateDuePolicyVersions(prisma, new Date(futureEffective.getTime() + 1));
    versions = await prisma.policyVersion.findMany({
      where: { policyId },
      orderBy: { versionNo: "asc" },
    });
    expect(versions.map((version) => [version.versionNo, version.state])).toEqual([
      [1, "RETIRED"],
      [2, "RETIRED"],
      [3, "ACTIVE"],
    ]);
    expect(
      await prisma.auditEvent.count({
        where: {
          companyId,
          resourceId: policyId,
          action: "operational_policy.scheduled_activated",
        },
      }),
    ).toBe(1);
  });
});
