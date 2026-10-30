import type { AuthPrincipal } from "@evflow/contracts";
import {
  isMenuAvailable,
  menuRoutes,
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
  it("opens Setting > Pemetaan Akun only with account_mapping.read and no longer lists it in Finance", () => {
    expect(
      visibleMenuItems(principal([], ["account_mapping.read"]), "Setting").map((i) => [
        i.label,
        i.href,
      ]),
    ).toEqual([["Pemetaan Akun", "/setting/account-mapping"]]);
    expect(
      visibleMenuItems(principal([], ["posting_profile.read"]), "Setting").map((i) => i.label),
    ).not.toContain("Pemetaan Akun");
    const paths = navigationMatrixRows([]).map((row) => row.path);
    expect(paths).toContain("Setting › Pemetaan Akun");
    expect(paths).not.toContain("Finance › Akuntansi › Pengaturan Jurnal Otomatis");
    expect(visibleMenuItems(admin, "Finance").map((i) => i.label)).not.toContain(
      "Pengaturan Jurnal Otomatis",
    );
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
  it("each menu has exactly one home", () => {
    const homes = new Map<string, string>();
    for (const [module, routes] of Object.entries(menuRoutes))
      for (const [item, href] of Object.entries(routes)) {
        expect(href).not.toContain("/operations/controls");
        expect(
          homes.get(href),
          `${module} › ${item} duplicates ${homes.get(href)}`,
        ).toBeUndefined();
        homes.set(href, `${module} › ${item}`);
      }
    const finance = visibleMenuItems(admin, "Finance").map((i) => i.label);
    expect(finance).not.toContain("Kredit & TOP Pelanggan");
    expect(visibleMenuItems(admin, "Warehouse & Logistik").map((i) => i.label)).toContain(
      "Persediaan",
    );
  });
  it("Setting lists the consolidated submenus in order", () => {
    expect(visibleMenuItems(admin, "Setting").map((i) => i.label)).toEqual([
      "Profil Perusahaan",
      "Pengguna",
      "Peran",
      "Kebijakan Umum",
      "Penomoran Dokumen",
      "Pajak",
      "Termin & Kredit",
      "Jenis Potongan",
      "Pemetaan Akun",
    ]);
  });
  it("leaves no matrix rows for retired policy, posting profile or tax master grants", () => {
    const perm = (resource: string) => ({
      id: `${resource}.read`,
      code: `${resource}.read`,
      resource,
      action: "read",
      description: null,
    });
    const paths = navigationMatrixRows([
      perm("operational_policy"),
      perm("posting_profile"),
      perm("tax_master"),
    ]).map((row) => row.path);
    expect(paths.filter((p) => p.startsWith("Fitur lain"))).toEqual([]);
    expect(paths).not.toContain("Finance › Kredit & TOP Pelanggan");
    expect(paths).not.toContain("Setting › Pengaturan Persetujuan");
    expect(paths).not.toContain("Finance › Pajak › Daftar & Aturan Pajak");
    const tax = navigationMatrixRows([perm("tax_rule"), perm("sales_tax_rule")]).map((r) => r.path);
    expect(tax.filter((p) => /WAPU|Fitur lain/.test(p))).toEqual([]);
    expect(paths.filter((p) => p.startsWith("Finance › Pajak"))).toEqual([
      "Finance › Pajak › Faktur Keluaran",
      "Finance › Pajak › Faktur Masukan",
    ]);
  });
});
