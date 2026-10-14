import { randomUUID } from "node:crypto";
import { financeDashboardResponseSchema, type AuthPrincipal } from "@evflow/contracts";
import { FinanceDashboardService } from "../../packages/backend/src/dashboard/finance-dashboard.service";

describe("Finance dashboard access and unavailable sources", () => {
  const companyId = randomUUID();
  const principal: AuthPrincipal = {
    company_id: companyId,
    user_id: randomUUID(),
    membership_id: randomUUID(),
    company_name: "DATA UJI",
    display_name: "Tester",
    email: "finance@example.invalid",
    roles: [],
    permissions: [{ code: "finance.read", scope_type: "company", scope_id: companyId }],
  };
  const service = new FinanceDashboardService();
  it("reports unavailable money and closing without fabricating balances or an open period", () => {
    const data = service.read(principal, { month: "2026-09" });
    expect(financeDashboardResponseSchema.safeParse({ data }).success).toBe(true);
    expect(data.company_id).toBe(companyId);
    expect(data.metrics).toHaveLength(4);
    expect(
      data.metrics.every(
        (m) => m.unit === "IDR" && m.value === null && m.freshness === "unavailable",
      ),
    ).toBe(true);
    expect(
      Object.values(data.closing).every((s) => s.value === null && s.freshness === "unavailable"),
    ).toBe(true);
    expect(data.total_actions).toBeNull();
    expect(data.actions).toEqual([]);
  });
  it("accepts explicit company/privileged access and echoes only validated filters", () => {
    for (const scope_type of ["company", "privileged"]) {
      const data = service.read(
        { ...principal, permissions: [{ code: "finance.read", scope_type, scope_id: null }] },
        { month: "2026-02", process: "matching" },
      );
      expect(data.month).toBe("2026-02");
      expect(data.process).toBe("matching");
    }
  });
  it("rejects unrelated, narrow and cross-company grants, regardless of role name", () => {
    for (const permissions of [
      [],
      [{ code: "master_data.read", scope_type: "company", scope_id: null }],
      ...["self", "department", "warehouse"].map((scope_type) => [
        { code: "finance.read", scope_type, scope_id: companyId },
      ]),
      ...["company", "privileged"].map((scope_type) => [
        { code: "finance.read", scope_type, scope_id: randomUUID() },
      ]),
    ]) {
      expect(() =>
        service.read(
          { ...principal, roles: [{ code: "ADMIN_SYSTEM", name: "Admin" }], permissions },
          { month: "2026-09" },
        ),
      ).toThrow("Izin atau scope tidak mencukupi.");
    }
  });
  it("rejects malformed periods, duplicate inputs and injected scope", () => {
    for (const query of [
      {},
      { month: "2026-13" },
      { month: "2026-9" },
      { month: "2026-09", process: "paid" },
      { month: ["2026-09"] },
      { month: "2026-09", company_id: randomUUID() },
      { month: "2026-09", include_payroll: true },
    ])
      expect(() => service.read(principal, query)).toThrow("Filter Dashboard Finance tidak valid.");
  });
});
