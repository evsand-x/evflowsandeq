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
});
