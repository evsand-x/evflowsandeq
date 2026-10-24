import { operationalPolicyCatalog } from "@evflow/database";
import {
  policyFormValue,
  policyPayload,
  initialResetPeriod,
  lockDraft,
  previewDocumentNumber,
} from "../../apps/office/app/setting/settings-forms";

const terms = operationalPolicyCatalog.find((p) => p.code === "OPS-FLX-03")!;

describe("settings form helpers", () => {
  it("round-trips term list", () => {
    const policy = { code: "OPS-FLX-03", active_version: { value: terms.default } };
    expect(policyPayload("OPS-FLX-03", policyFormValue(policy)).value).toEqual(terms.default);
  });
  it("freight borne by company ignores tax position", () => {
    expect(policyPayload("OPS-FLX-04", { mode: "COMPANY", tax_position: "AFTER_TAX" })).toEqual({
      value: { mode: "COMPANY", tax_position: "BEFORE_TAX" },
    });
  });
  it("form value is a copy, not the cached policy", () => {
    const policy = { code: "OPS-FLX-03", active_version: { value: terms.default } };
    const form = policyFormValue(policy) as Array<{ label: string }>;
    form[0]!.label = "Ubah";
    expect((terms.default as Array<{ label: string }>)[0]!.label).toBe("Tunai/COD");
  });
  it("client preview matches server format", () => {
    expect(previewDocumentNumber("SO-SSM", "YYYY", 4, "2026-10-24", "3")).toBe(
      "SO-SSM.2026.10.0003",
    );
    expect(previewDocumentNumber("SO-SSM", "YY", 4, "2026-10-24", "3")).toBe("SO-SSM.26.10.0003");
  });
  it("dialog starts from the scheduled reset period", () => {
    expect(
      initialResetPeriod({ reset_period: "YEARLY", pending: { reset_period: "MONTHLY" } }),
    ).toBe("MONTHLY");
    expect(initialResetPeriod({ reset_period: "YEARLY", pending: null })).toBe("YEARLY");
  });
});

describe("version-locked drafts", () => {
  it("locks the version at edit start", () => {
    const first = lockDraft(null, { version: 3, value: "a" }, "b");
    expect(first).toEqual({ version: 3, value: "b" });
    // someone else saved meanwhile: the source moved to v4, but the draft keeps v3
    expect(lockDraft(first, { version: 4, value: "x" }, "c")).toEqual({ version: 3, value: "c" });
  });
  it("does nothing without a source", () => {
    expect(lockDraft(null, undefined, "b")).toBeNull();
  });
});
