import type { AuthPrincipal } from "@evflow/contracts";
import { describe, expect, it } from "vitest";
import { moduleNavigation, visibleDashboardViews, visibleModules } from "./navigation";

const companyId = "00000000-0000-4000-8000-000000000001";
const principal: AuthPrincipal = {
  user_id: "00000000-0000-4000-8000-000000000002",
  membership_id: "00000000-0000-4000-8000-000000000003",
  company_id: companyId,
  company_name: "PT Sandeq Sarana Medika",
  display_name: "Demo",
  email: "demo@evflow.local",
  roles: [],
  permissions: [
    "crm_prospect.read",
    "dashboard_executive.read",
    "dashboard_sales.read",
    "dashboard_actions.read",
    "dashboard_reports.read",
  ].map((code) => ({ code, scope_type: "company", scope_id: null })),
};

describe("permission-aware Dashboard navigation", () => {
  it("omits the removed Master Data submenus", () => {
    const master = moduleNavigation.find((module) => module.label === "Master Data");
    expect(master?.items).not.toContain("Referensi Reusable");
    expect(master?.items).not.toContain("Ringkasan Lintas Domain");
  });

  it("places the permission matrix inside Peran, not as a standalone Setting submenu", () => {
    const setting = moduleNavigation.find((module) => module.label === "Setting");
    expect(setting?.items).toContain("Peran");
    expect(setting?.items).not.toContain("Matriks Hak Akses");
  });

  it("shows Setting to a role administrator without company profile access", () => {
    const roleAdmin = {
      ...principal,
      roles: [{ code: "ADMIN_SYSTEM", name: "Admin Sistem" }],
      permissions: [{ code: "role.read", scope_type: "company", scope_id: null }],
    };
    expect(visibleModules(roleAdmin).map((module) => module.label)).toEqual(
      moduleNavigation.map((module) => module.label),
    );
  });
  it("hides access management even when a nonadministrator holds IAM grants", () => {
    const nonAdmin = {
      ...principal,
      roles: [{ code: "SALES", name: "Admin Sistem" }],
      permissions: ["user.read", "role.read", "permission.read"].map((code) => ({
        code,
        scope_type: "company",
        scope_id: null,
      })),
    };
    expect(visibleModules(nonAdmin)).toEqual([]);
  });
  it("shows Dashboard first and hides unauthorized modules", () => {
    expect(visibleDashboardViews(principal).map((view) => view.id)).toEqual([
      "executive",
      "sales",
      "actions",
      "reports",
    ]);
    expect(visibleModules(principal).map((module) => module.label)).toEqual(["Sales & Marketing"]);
  });

  it("rejects a permission scoped to another company", () => {
    const other = {
      ...principal,
      permissions: [
        {
          code: "crm_prospect.read",
          scope_type: "company",
          scope_id: "00000000-0000-4000-8000-000000000099",
        },
      ],
    };
    expect(visibleModules(other)).toEqual([]);
    expect(visibleDashboardViews(other).some((view) => view.id === "sales")).toBe(false);
  });

  it("shows every main module when the account has the matching company read grants", () => {
    const fullAccess = {
      ...principal,
      permissions: [
        "crm_prospect.read",
        "warehouse.read",
        "finance.read",
        "hr.read",
        "master_customer.read",
        "company_profile.read",
        "dashboard_executive.read",
        "dashboard_sales.read",
        "dashboard_warehouse.read",
        "dashboard_finance.read",
        "dashboard_hris.read",
        "dashboard_actions.read",
        "dashboard_reports.read",
      ].map((code) => ({ code, scope_type: "company", scope_id: null })),
    };
    expect(visibleModules(fullAccess).map((module) => module.label)).toEqual([
      "Sales & Marketing",
      "Warehouse & Logistik",
      "Finance",
      "HRIS",
      "Master Data",
      "Setting",
    ]);
    expect(visibleDashboardViews(fullAccess).map((view) => view.id)).toEqual([
      "executive",
      "sales",
      "warehouse",
      "finance",
      "hris",
      "actions",
      "reports",
    ]);
  });
});
