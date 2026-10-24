import type { AuthPrincipal } from "@evflow/contracts";
import {
  isMenuAvailable,
  visibleMenuItems,
  visibleModules,
} from "../../apps/office/lib/navigation";
import { navigationMatrixRows } from "../../apps/office/lib/access-matrix-navigation";

const company = "00000000-0000-4000-8000-000000000001";
const principal = (roles: string[], codes: string[]) =>
  ({
    user_id: "u",
    company_id: company,
    company_name: "PT LIVIANA DWI BERKAT",
    roles: roles.map((code) => ({ code, name: code })),
    permissions: codes.map((code) => ({ code, scope_type: "company", scope_id: null })),
  }) as unknown as AuthPrincipal;
const admin = principal(["ADMIN_SYSTEM"], []);

describe("navigation shows only working menus", () => {
  it("hides menu items without a route", () => {
    const labels = visibleMenuItems(admin, "Setting").map((item) => item.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Profil Perusahaan", "Penomoran Dokumen", "Pengguna", "Peran"]),
    );
    for (const missing of ["Template Cetak", "Audit", "Periode & Closing"])
      expect(labels).not.toContain(missing);
    expect(isMenuAvailable("Setting", "Template Cetak")).toBe(false);
  });
  it("hides Setting items without permission", () => {
    expect(
      visibleMenuItems(principal([], ["numbering_rule.read"]), "Setting").map((i) => i.label),
    ).toEqual(["Penomoran Dokumen"]);
  });
  it("opens Setting > Pajak only with its own tax_setting grant", () => {
    expect(
      visibleMenuItems(principal([], ["tax_setting.read"]), "Setting").map((i) => [
        i.label,
        i.href,
      ]),
    ).toEqual([["Pajak", "/setting/tax"]]);
    expect(
      visibleMenuItems(principal([], ["setting_general.read"]), "Setting").map((i) => i.label),
    ).not.toContain("Pajak");
    expect(navigationMatrixRows([]).map((row) => row.path)).toContain("Setting › Pajak");
  });
  it("opens Setting > Jenis Potongan only with deduction_type.read", () => {
    expect(
      visibleMenuItems(principal([], ["deduction_type.read"]), "Setting").map((i) => [
        i.label,
        i.href,
      ]),
    ).toEqual([["Jenis Potongan", "/setting/deductions"]]);
    expect(
      visibleMenuItems(principal([], ["tax_setting.read"]), "Setting").map((i) => i.label),
    ).not.toContain("Jenis Potongan");
    expect(navigationMatrixRows([]).map((row) => row.path)).toContain("Setting › Jenis Potongan");
  });
  it("hides a module with no visible item", () => {
    expect(visibleModules(admin).map((m) => m.label)).not.toContain("HRIS");
    expect(visibleModules(admin).map((m) => m.label)).toContain("Setting");
  });
  it("matrix omits rows of unavailable menus", () => {
    const paths = navigationMatrixRows([]).map((row) => row.path);
    expect(paths.some((p) => p.startsWith("Setting › Template Cetak"))).toBe(false);
    expect(paths).toContain("Setting › Penomoran Dokumen");
  });
});
