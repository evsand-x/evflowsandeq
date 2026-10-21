import { describe, expect, it } from "vitest";
import type { AuthPrincipal } from "@evflow/contracts";
import { requireDashboardView } from "./workspace-access";

const principal: AuthPrincipal = {
  user_id: "00000000-0000-4000-8000-000000000002",
  membership_id: "00000000-0000-4000-8000-000000000003",
  company_id: "00000000-0000-4000-8000-000000000001",
  company_name: "Example",
  display_name: "Member",
  email: "member@example.test",
  roles: [],
  permissions: [],
};

describe("Dashboard view permissions", () => {
  it("rejects a role without the view grant", () => {
    expect(() => requireDashboardView(principal, "sales")).toThrow();
  });
  it("allows the explicitly granted view", () => {
    expect(() =>
      requireDashboardView(
        {
          ...principal,
          permissions: [{ code: "dashboard_sales.read", scope_type: "company", scope_id: null }],
        },
        "sales",
      ),
    ).not.toThrow();
  });
  it("keeps Admin Sistem full access without stored grants", () => {
    expect(() =>
      requireDashboardView(
        {
          ...principal,
          roles: [{ code: "ADMIN_SYSTEM", name: "Admin Sistem" }],
        },
        "reports",
      ),
    ).not.toThrow();
  });
});
