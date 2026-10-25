import { ApiError, settingsHrefOf, translateProblem } from "../../apps/office/lib/api";

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
  it("sends a missing COD term and an invalid customer term to Setting > Termin & Kredit", () => {
    for (const detail of ["PAYMENT_POLICY_REQUIRED", "PAYMENT_TERM_INVALID"]) {
      const out = translateProblem({ detail });
      expect(out.message).toContain("Setting › Termin & Kredit");
      expect(out.settings_href).toBe("/setting/terms");
    }
  });
  it("explains tax master conflicts in business words", () => {
    for (const detail of [
      "TAX_DEFAULT_INVALID",
      "TAX_DEFAULT_REQUIRED_ACTIVE",
      "TAX_VERSION_CONFLICT",
      "TAX_NAME_EXISTS",
      "TAX_ACCOUNT_INVALID",
      "LINE_TAX_NOT_ALLOWED",
      "FREIGHT_TAX_RULE_NOT_ALLOWED",
    ])
      expect(translateProblem({ detail }).message).not.toMatch(/^[A-Z_]+$/);
  });
  it("translates posting profile conflict with a link", () => {
    const out = translateProblem({ detail: "POSTING_PROFILE_REQUIRED_OR_CONFLICTING" });
    expect(out.message).toContain("Setting › Pemetaan Akun");
    expect(out.settings_href).toBe("/setting/account-mapping");
  });
  it("explains an idempotency mismatch without a link", () => {
    const out = translateProblem({ detail: "IDEMPOTENCY_PAYLOAD_MISMATCH" });
    expect(out.message).not.toMatch(/^[A-Z_]+$/);
    expect(out.settings_href).toBeUndefined();
  });
  it("reads the Setting link from an ApiError", () => {
    expect(settingsHrefOf(new ApiError(409, "x", { settings_href: "/setting/tax" }))).toBe(
      "/setting/tax",
    );
    expect(
      settingsHrefOf(new ApiError(409, "x", { settings_href: "https://evil" })),
    ).toBeUndefined();
    expect(settingsHrefOf(new Error("x"))).toBeUndefined();
  });
});
