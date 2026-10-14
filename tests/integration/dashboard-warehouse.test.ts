import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { warehouseDashboardResponseSchema, type AuthPrincipal } from "@evflow/contracts";
import { WarehouseDashboardService } from "../../packages/backend/src/dashboard/warehouse-dashboard.service";

describe("Warehouse dashboard scope and source availability", () => {
  const companyId = randomUUID(),
    otherCompanyId = randomUUID(),
    userId = randomUUID();
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const service = new WarehouseDashboardService();
  const principal: AuthPrincipal = {
    user_id: userId,
    membership_id: randomUUID(),
    company_id: companyId,
    company_name: "DATA UJI",
    display_name: "Tester",
    email: `${userId}@example.invalid`,
    roles: [],
    permissions: [{ code: "warehouse.read", scope_type: "company", scope_id: null }],
  };
  beforeAll(async () => {
    await prisma.company.createMany({
      data: [companyId, otherCompanyId].map((id) => ({ id, name: "DATA UJI WAREHOUSE" })),
    });
    await prisma.warehouse.createMany({
      data: ids.map((id, i) => ({
        id,
        companyId: i === 4 ? otherCompanyId : companyId,
        code: `WH-${i}`,
        name: `Gudang ${i}`,
        normalizedName: `gudang ${i}`,
        timezone: "Asia/Makassar",
        state: i === 2 ? "DRAFT" : i === 3 ? "INACTIVE" : "ACTIVE",
        createdById: userId,
        updatedById: userId,
      })),
    });
  });
  afterAll(async () => {
    await prisma.warehouse.deleteMany({
      where: { companyId: { in: [companyId, otherCompanyId] } },
    });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    await prisma.$disconnect();
  });
  it("reads only active permitted company warehouses and never fabricates operational zeros", async () => {
    const data = await service.read(principal, { month: "2026-09" });
    expect(warehouseDashboardResponseSchema.safeParse({ data }).success).toBe(true);
    expect(data.warehouses.map((w) => w.id)).toEqual(ids.slice(0, 2));
    expect(data.warehouses[0]).toEqual({ id: ids[0], code: "WH-0", name: "Gudang 0" });
    expect(data.metrics).toHaveLength(7);
    expect(data.metrics.every((m) => m.value === null && m.freshness === "unavailable")).toBe(true);
    expect(data.total_actions).toBeNull();
    expect(data.actions_status).toBe("unavailable");
  });
  it("unions warehouse grants while enforcing company and active state", async () => {
    const scoped = {
      ...principal,
      permissions: [ids[0]!, ids[1]!, ids[4]!].map((scope_id) => ({
        code: "warehouse.read",
        scope_type: "warehouse",
        scope_id,
      })),
    };
    const data = await service.read(scoped, {
      month: "2026-09",
      warehouse_id: ids[1],
      stage: "quality",
    });
    expect(data.warehouses.map((w) => w.id)).toEqual(ids.slice(0, 2));
    expect(data.warehouse_id).toBe(ids[1]);
    expect(data.stage).toBe("quality");
    const one = {
      ...principal,
      permissions: [{ code: "warehouse.read", scope_type: "warehouse", scope_id: ids[0]! }],
    };
    expect((await service.read(one, { month: "2026-09" })).warehouses.map((w) => w.id)).toEqual([
      ids[0],
    ]);
    for (const warehouse_id of [ids[1], ids[2], ids[4], randomUUID()])
      await expect(service.read(one, { month: "2026-09", warehouse_id })).rejects.toMatchObject({
        status: 403,
      });
  });
  it("rejects absent, unrelated, invalid-company and unusable warehouse grants", async () => {
    for (const permissions of [
      [],
      [{ code: "master_data.read", scope_type: "company", scope_id: null }],
      [{ code: "warehouse.read", scope_type: "company", scope_id: otherCompanyId }],
      [{ code: "warehouse.read", scope_type: "self", scope_id: null }],
      [{ code: "warehouse.read", scope_type: "warehouse", scope_id: null }],
      ...[ids[2]!, ids[4]!, randomUUID()].map((scope_id) => [
        { code: "warehouse.read", scope_type: "warehouse", scope_id },
      ]),
    ]) {
      await expect(
        service.read({ ...principal, permissions }, { month: "2026-09" }),
      ).rejects.toMatchObject({ status: 403 });
    }
  });
  it("rejects injected scope parameters and invalid month, stage or warehouse", async () => {
    for (const query of [
      { month: "2026-13" },
      { month: "2026-9" },
      { month: "2026-09", company_id: otherCompanyId },
      { month: "2026-09", stage: "unexpected" },
      { month: "2026-09", warehouse_id: "invalid" },
      { month: ["2026-09", "2026-10"] },
    ])
      await expect(service.read(principal, query)).rejects.toMatchObject({ status: 400 });
    for (const warehouse_id of [ids[2], ids[3], ids[4]])
      await expect(
        service.read(principal, { month: "2026-09", warehouse_id }),
      ).rejects.toMatchObject({ status: 403 });
  });
  it("returns a legitimate empty warehouse selector without implying zero stock", async () => {
    const data = await service.read(
      { ...principal, company_id: randomUUID() },
      { month: "2026-09" },
    );
    expect(data.warehouses).toEqual([]);
    expect(data.freshness).toBe("unavailable");
    expect(data.total_actions).toBeNull();
  });
});
