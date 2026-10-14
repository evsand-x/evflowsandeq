import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import {
  salesDashboardResponseSchema,
  type AuthPrincipal,
  type SalesDashboardQuery,
} from "@evflow/contracts";
import { SalesDashboardService } from "../../packages/backend/src/dashboard/sales-dashboard.service";
import { ActionQueueService } from "../../packages/backend/src/dashboard/action-queue.service";
import { actionQueueResponseSchema } from "@evflow/contracts";

describe("Sales dashboard live prospect schedule", () => {
  const companyId = randomUUID(),
    otherCompanyId = randomUUID();
  const userId = randomUUID(),
    otherUserId = randomUUID();
  const companies = [companyId, otherCompanyId];
  const users = [userId, otherUserId];
  const service = new SalesDashboardService();
  const queue = new ActionQueueService();
  const principal: AuthPrincipal = {
    user_id: userId,
    company_id: companyId,
    membership_id: randomUUID(),
    company_name: "DATA UJI SALES",
    display_name: "Tester",
    email: `${userId}@example.invalid`,
    roles: [],
    permissions: [{ code: "crm.read", scope_type: "company", scope_id: null }],
  };
  const query: SalesDashboardQuery = { month: "2026-02", status: "all", sort: "asc", limit: 2 };
  beforeAll(async () => {
    await prisma.company.createMany({
      data: companies.map((id) => ({ id, name: "DATA UJI SALES" })),
    });
    await prisma.user.createMany({
      data: users.map((id) => ({
        id,
        email: `${id}@example.invalid`,
        displayName: "DATA UJI",
        passwordHash: "DISABLED",
      })),
    });
    const samples = [
      { date: "2026-01-31T16:00:00.000Z" },
      { date: "2026-02-10T00:00:00.000Z" },
      { date: "2026-02-10T00:00:00.000Z" },
      { date: "2026-02-28T15:59:59.999Z" },
      { date: "2026-01-31T15:59:59.999Z" },
      { date: "2026-02-28T16:00:00.000Z" },
      { date: "2026-02-10T00:00:00.000Z", company: otherCompanyId },
      { date: "2026-02-10T00:00:00.000Z", owner: otherUserId },
      { date: "2026-02-10T00:00:00.000Z", status: "DEFERRED" as const },
      { date: "2026-02-10T00:00:00.000Z", status: "DROPPED" as const },
      { date: "2026-02-10T00:00:00.000Z", noAction: true },
      { date: "2099-02-10T00:00:00.000Z" },
    ];
    for (const [i, sample] of samples.entries()) {
      const c = sample.company ?? companyId;
      const customer = await prisma.customer.create({
        data: {
          companyId: c,
          code: `SALES-${i}`,
          name: `Pelanggan ${i}`,
          normalizedName: `pelanggan ${i}`,
          createdById: userId,
          updatedById: userId,
        },
      });
      await prisma.prospect.create({
        data: {
          companyId: c,
          customerId: customer.id,
          code: `PRO-${i}`,
          ownerId: sample.owner ?? userId,
          nextAction: sample.noAction ? null : `Tindak lanjut ${i}`,
          nextActionAt: new Date(sample.date),
          approachStatus: sample.status ?? "NEW",
          createdById: userId,
          updatedById: userId,
        },
      });
    }
  });
  afterAll(async () => {
    await prisma.prospect.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.customer.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.company.deleteMany({ where: { id: { in: companies } } });
    await prisma.$disconnect();
  });
  it("aggregates personal followups with WITA bounds, server totals and stable cursor", async () => {
    const filter = { month: "2026-02", tab: "followups", limit: 2 };
    const first = await queue.read(principal, filter);
    expect(actionQueueResponseSchema.safeParse({ data: first }).success).toBe(true);
    expect(first.total).toBe(4);
    expect(first.metrics.followups.value).toBe(4);
    expect(first.metrics.overdue.value).toBe(4);
    expect(first.metrics.approvals.value).toBeNull();
    const second = await queue.read(principal, { ...filter, cursor: first.next_cursor });
    expect(new Set([...first.items, ...second.items].map((r) => r.id)).size).toBe(4);
    expect(second.next_cursor).toBeNull();
    expect(second.items.at(-1)?.reference).toBe("PRO-3");
    expect(
      first.items.every(
        (r) => r.source_version === 1 && r.destination === `/crm/prospects/${r.id}`,
      ),
    ).toBe(true);
    await expect(
      queue.read(principal, { ...filter, search: "PRO-0", cursor: first.next_cursor }),
    ).rejects.toThrow("Cursor");
  });
  it("searches and sorts all authorized followups before pagination", async () => {
    const filter = { month: "2026-02", tab: "followups", limit: 1 };
    expect(
      (await queue.read(principal, { ...filter, search: "Pelanggan 3" })).items[0]?.reference,
    ).toBe("PRO-3");
    expect((await queue.read(principal, { ...filter, sort: "desc" })).items[0]?.reference).toBe(
      "PRO-3",
    );
    expect((await queue.read(principal, { ...filter, search: "NO-MATCH" })).total).toBe(0);
    for (const raw of [
      { ...filter, company_id: otherCompanyId },
      { ...filter, owner_id: otherUserId },
      { ...filter, month: "2026-13" },
      { ...filter, tab: "approve" },
      { ...filter, cursor: "malformed" },
    ])
      await expect(queue.read(principal, raw)).rejects.toThrow();
  });
  it("never infers approval or completion from CRM, nor exposes unauthorized followups", async () => {
    for (const tab of ["approvals", "completed"]) {
      const result = await queue.read(principal, { month: "2026-02", tab });
      expect(result.items).toEqual([]);
      expect(result.total).toBeNull();
      expect(result.status).toBe("unavailable");
    }
    for (const permissions of [
      [],
      [{ code: "crm.read", scope_type: "company", scope_id: otherCompanyId }],
      [{ code: "crm.read", scope_type: "self", scope_id: null }],
    ]) {
      const result = await queue.read(
        { ...principal, permissions },
        { month: "2026-02", tab: "followups" },
      );
      expect(result.items).toEqual([]);
      expect(result.metrics.followups.value).toBeNull();
    }
    expect(
      (await queue.read(principal, { month: "2026-02", tab: "followups", module: "hris" })).total,
    ).toBeNull();
  });
  it("uses WITA boundaries, isolates company/owner, excludes deferred/dropped and paginates ties", async () => {
    const first = await service.read(principal, query);
    expect(salesDashboardResponseSchema.safeParse({ data: first }).success).toBe(true);
    expect(first.total_actions).toBe(4);
    expect(first.actions[0]?.reference).toBe("PRO-0");
    const second = await service.read(principal, { ...query, cursor: first.next_cursor! });
    expect(second.next_cursor).toBeNull();
    expect(second.total_actions).toBe(4);
    expect(new Set([...first.actions, ...second.actions].map((r) => r.id)).size).toBe(4);
    expect(second.actions.at(-1)?.reference).toBe("PRO-3");
    expect(first.metrics.every((m) => m.value === null && m.freshness === "unavailable")).toBe(
      true,
    );
  });
  it("sorts and filters on server without inventing transaction data", async () => {
    expect((await service.read(principal, { ...query, sort: "desc" })).actions[0]?.reference).toBe(
      "PRO-3",
    );
    expect((await service.read(principal, { ...query, status: "overdue" })).total_actions).toBe(4);
    expect((await service.read(principal, { ...query, status: "upcoming" })).total_actions).toBe(0);
    expect(
      (await service.read(principal, { ...query, month: "2099-02", status: "upcoming" }))
        .total_actions,
    ).toBe(1);
    expect(
      (await service.read(principal, { ...query, month: "2099-02", status: "overdue" }))
        .total_actions,
    ).toBe(0);
    expect((await service.read(principal, { ...query, month: "2025-01" })).actions).toEqual([]);
  });
  it("rejects missing, narrow and mismatched permissions before data access", async () => {
    for (const permissions of [
      [],
      [{ code: "crm.read", scope_type: "self", scope_id: null }],
      [{ code: "crm.read", scope_type: "company", scope_id: otherCompanyId }],
    ]) {
      await expect(service.read({ ...principal, permissions }, query)).rejects.toMatchObject({
        status: 403,
      });
    }
  });
  it("rejects invalid month, limits and cursor/filter mismatch", async () => {
    for (const invalid of [{ month: "2026-13" }, { limit: 51 }, { cursor: "invalid" }]) {
      await expect(service.read(principal, { ...query, ...invalid })).rejects.toMatchObject({
        status: 400,
      });
    }
    const first = await service.read(principal, query);
    await expect(
      service.read(principal, { ...query, month: "2026-03", cursor: first.next_cursor! }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
