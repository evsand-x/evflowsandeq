import catalog from "../../packages/database/src/data/operational-policies.json";
import {
  policyPermission,
  readablePolicyGroups,
  hasCompanyPermission,
} from "../../packages/backend/src/administration/setting-permissions";

describe("setting submenu permissions", () => {
  it("maps every catalog group to a submenu permission", () => {
    const groups = [...new Set(catalog.map((policy) => policy.group))];
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(policyPermission(group, "read")).toMatch(/^(setting_general|terms_credit)\.read$/);
      expect(policyPermission(group, "update")).toMatch(/^(setting_general|terms_credit)\.update$/);
    }
    expect(policyPermission("sales", "update")).toBe("terms_credit.update");
    expect(policyPermission("system", "read")).toBe("setting_general.read");
  });
  it("rejects an unknown group instead of falling back to a shared grant", () => {
    expect(() => policyPermission("unknown", "read")).toThrow();
  });
  it("lists readable groups per submenu grant", () => {
    const auth = (code: string) =>
      ({
        company_id: "c",
        roles: [],
        permissions: [{ code, scope_type: "company", scope_id: null }],
      }) as never;
    expect(readablePolicyGroups(auth("terms_credit.read"))).toEqual(["sales"]);
    expect(readablePolicyGroups(auth("setting_general.read"))).not.toContain("sales");
    expect(hasCompanyPermission(auth("x.read"), "setting_general.read")).toBe(false);
  });
});
