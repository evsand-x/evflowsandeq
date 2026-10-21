import { randomUUID } from "node:crypto";
import { DashboardService } from "../../packages/backend/src/dashboard/dashboard.service";
import type { AuthPrincipal } from "@evflow/contracts";
import { prisma } from "@evflow/database";

describe("Dashboard scope and CRM follow-up", () => {
  const companyId = randomUUID();
  const otherCompanyId = randomUUID();
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const service = new DashboardService();
  const principal: AuthPrincipal = {
    user_id: userId,
    membership_id: randomUUID(),
    company_id: companyId,
    company_name: "Dashboard Data Uji Fiktif",
    display_name: "Dashboard Tester",
    email: `dashboard-${userId}@evflow.local`,
    roles: [],
    permissions: [{ code: "crm_prospect.read", scope_type: "company", scope_id: null }],
  };

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.company.createMany({
      data: [
        { id: companyId, name: "Dashboard Data Uji Fiktif" },
        { id: otherCompanyId, name: "Dashboard Company Lain" },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: userId,
          email: principal.email,
          displayName: principal.display_name,
          passwordHash: "DISABLED",
        },
        {
          id: otherUserId,
          email: `dashboard-${otherUserId}@evflow.local`,
          displayName: "Other",
          passwordHash: "DISABLED",
        },
      ],
    });
    await prisma.customer.createMany({
      data: [
        {
          id: randomUUID(),
          companyId,
          code: "DASH-1",
          name: "Pelanggan Satu",
          normalizedName: "pelanggan satu",
          createdById: userId,
          updatedById: userId,
        },
        {
          id: randomUUID(),
          companyId: otherCompanyId,
          code: "DASH-2",
          name: "Pelanggan Lain",
          normalizedName: "pelanggan lain",
          createdById: otherUserId,
          updatedById: otherUserId,
        },
      ],
    });
    const customers = await prisma.customer.findMany({
      where: { companyId: { in: [companyId, otherCompanyId] } },
    });
    await prisma.prospect.createMany({
      data: [
        {
          companyId,
          customerId: customers.find((item) => item.companyId === companyId)!.id,
          code: "DASH-P1",
          ownerId: userId,
          nextAction: "Hubungi kembali",
          nextActionAt: new Date(Date.now() - 3_600_000),
          createdById: userId,
          updatedById: userId,
        },
        {
          companyId: otherCompanyId,
          customerId: customers.find((item) => item.companyId === otherCompanyId)!.id,
          code: "DASH-P2",
          ownerId: otherUserId,
          nextAction: "Rahasia perusahaan lain",
          nextActionAt: new Date(Date.now() - 3_600_000),
          createdById: otherUserId,
          updatedById: otherUserId,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.prospect.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.customer.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    await prisma.$disconnect();
  });

  it("shows only company-scoped CRM counts and own due actions", async () => {
    const summary = await service.summary(principal);
    expect(summary.sales?.metrics.find((item) => item.code === "prospects_total")?.value).toBe(1);
    expect(summary.sales?.actions).toHaveLength(1);
    expect(summary.sales?.actions[0]?.action).toBe("Hubungi kembali");
    for (const metric of summary.sales?.metrics ?? []) {
      expect(metric.unit).toBe("institusi");
      expect(metric.definition_version).toBe("crm-prospect-institutions-v1");
      expect(metric.data_as_of).toBe(summary.as_of);
      expect(metric.updated_at).toBe(summary.as_of);
      expect(metric.freshness).toBe("fresh");
    }
  });

  it("does not return CRM data without permission", async () => {
    const summary = await service.summary({ ...principal, permissions: [] });
    expect(summary.sales).toBeNull();
  });
});
