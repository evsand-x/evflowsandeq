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
});
