import { translateProblem } from "../../apps/office/lib/api";

describe("API problem translation", () => {
  it("translates numbering conflict into a Setting link", () => {
    expect(
      translateProblem({ detail: "NUMBERING_RULE_REQUIRED_OR_CONFLICTING:sales_order" }),
    ).toEqual({
      message:
        "Penomoran dokumen belum diatur. Buka Setting › Penomoran Dokumen untuk mengaktifkannya.",
      settings_href: "/setting/numbering",
    });
  });
  it("keeps other details", () => {
    expect(translateProblem({ detail: "Profil telah berubah." })).toEqual({
      message: "Profil telah berubah.",
    });
  });
  it("translates digit errors with the Setting path and clean characters", () => {
    for (const detail of ["NUMBERING_DIGITS_TOO_SHORT", "DOCUMENT_NUMBER_EXHAUSTED"]) {
      const out = translateProblem({ detail });
      expect(out.message).toContain("Setting › Penomoran Dokumen");
      expect(out.message).not.toContain("�");
      expect(out.settings_href).toBe("/setting/numbering");
    }
  });
  it("sends a missing default sales tax to Setting > Pajak", () => {
    const out = translateProblem({ detail: "DEFAULT_SALES_TAX_REQUIRED" });
    expect(out.message).toContain("Setting › Pajak");
    expect(out.settings_href).toBe("/setting/tax");
  });
  it("explains tax master conflicts in business words", () => {
    for (const detail of [
      "TAX_DEFAULT_INVALID",
      "TAX_DEFAULT_REQUIRED_ACTIVE",
      "TAX_VERSION_CONFLICT",
      "TAX_NAME_EXISTS",
      "TAX_ACCOUNT_INVALID",
    ])
      expect(translateProblem({ detail }).message).not.toMatch(/^[A-Z_]+$/);
  });
});
