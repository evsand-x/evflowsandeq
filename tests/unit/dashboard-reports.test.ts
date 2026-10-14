import { randomUUID } from "node:crypto";
import {
  reportCatalogResponseSchema,
  reportExportsResponseSchema,
  reportPreviewResponseSchema,
  type AuthPrincipal,
} from "@evflow/contracts";
import { ReportsService } from "../../packages/backend/src/dashboard/reports.service";

describe("Dashboard report catalog and export boundaries", () => {
  const service = new ReportsService();
  const principal: AuthPrincipal = {
    company_id: randomUUID(),
    user_id: randomUUID(),
    membership_id: randomUUID(),
    company_name: "TEST",
    display_name: "TEST",
    email: "report@example.invalid",
    roles: [{ code: "ADMIN", name: "Admin" }],
    permissions: [],
  };
  const finance = {
    ...principal,
    permissions: [{ code: "finance.read", scope_type: "company", scope_id: principal.company_id }],
  };
  it("filters catalog by explicit company permission, not role name", () => {
    expect(service.catalog(principal).items).toEqual([]);
    const data = service.catalog(finance);
    expect(reportCatalogResponseSchema.safeParse({ data }).success).toBe(true);
    expect(data.items.map((r) => r.code)).toEqual(["ar-aging", "trial-balance"]);
    expect(data.items.every((r) => !r.can_export && r.status === "unavailable")).toBe(true);
  });
  it("does not elevate narrow or other-company access", () => {
    for (const [scope_type, scope_id] of [
      ["company", randomUUID()],
      ["privileged", randomUUID()],
      ["self", null],
      ["department", null],
      ["warehouse", randomUUID()],
    ] as const) {
      const p = { ...principal, permissions: [{ code: "finance.read", scope_type, scope_id }] };
      expect(service.catalog(p).items).toEqual([]);
      expect(() => service.preview(p, "ar-aging", { as_of: "2026-09-28" })).toThrow(
        "Izin atau scope",
      );
    }
  });
  it("rejects invalid dates, scope injection and unknown formats", () => {
    for (const raw of [
      { as_of: "2026-02-30" },
      { as_of: "2026-13-01" },
      { as_of: "2026-09-28", scope: "all_companies" },
      { as_of: "2026-09-28", company_id: randomUUID() },
      { as_of: ["2026-09-28"] },
      { as_of: "2026-09-28", format: "exe" },
    ]) {
      expect(() => service.preview(finance, "ar-aging", raw)).toThrow("Parameter laporan");
    }
    expect(() => service.catalog(finance, { company_id: randomUUID() })).toThrow();
    expect(() => service.exports(finance, { requested_by: randomUUID() })).toThrow();
    expect(() => service.preview(finance, "unknown", { as_of: "2026-09-28" })).toThrow(
      "tidak ditemukan",
    );
  });
  it("validates leap dates and never emits payroll, file URL or invented ledger rows", () => {
    const data = service.preview(finance, "ar-aging", { as_of: "2024-02-29", format: "xlsx" });
    expect(reportPreviewResponseSchema.safeParse({ data }).success).toBe(true);
    expect(data.rows).toEqual([]);
    expect(
      reportPreviewResponseSchema.safeParse({
        data: { ...data, rows: [{ payroll_amount: "100" }] },
      }).success,
    ).toBe(false);
    const exports = service.exports(finance);
    expect(reportExportsResponseSchema.safeParse({ data: exports }).success).toBe(true);
    expect(exports.total).toBeNull();
    expect(
      reportExportsResponseSchema.safeParse({
        data: { ...exports, items: [{ url: "https://example.invalid/private" }] },
      }).success,
    ).toBe(false);
  });
  it("blocks export without a generator and never promotes read access to export", () => {
    expect(() => service.requestExport(finance, "ar-aging", { as_of: "2026-09-28" })).toThrow(
      "Tidak ada pekerjaan atau file",
    );
    expect(() => service.requestExport(principal, "ar-aging", { as_of: "2026-09-28" })).toThrow(
      "Izin atau scope",
    );
    expect(service.exports(finance).items).toEqual([]);
  });
});
