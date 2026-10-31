import {
  marginNote,
  parseFactor,
  parseMoney,
  parseTemperature,
  permitPayload,
  productCodePattern,
  productReadiness,
} from "../../apps/office/app/master-data/products/product-form-utils";

const ready = {
  storage_notes: "Simpan kering.",
  min_temp: "2",
  max_temp: "30",
  humidity_limits: "",
  source_document: "",
  expiry_required: true,
  shelf_life_days: "730",
};
const permit = {
  permit_type: "AKD" as const,
  permit_number: "",
  holder: "",
  issued_on: "",
  expires_on: "",
  evidence: "",
};

describe("product form helpers", () => {
  it("parses Indonesian money, factors and temperatures", () => {
    expect(parseMoney("125.000")).toBe("125000");
    expect(parseMoney("125.000,50")).toBe("125000.50");
    expect(parseMoney("abc")).toBeNull();
    expect(parseFactor("0,01")).toBe("0.01");
    expect(parseFactor("20")).toBe("20");
    expect(parseFactor("0")).toBeNull();
    expect(parseTemperature("-20")).toBe("-20");
    expect(parseTemperature("2,5")).toBe("2.5");
    expect(parseTemperature("hangat")).toBeNull();
  });
  it("validates the manual product code", () => {
    expect(productCodePattern.test("SPU-003")).toBe(true);
    expect(productCodePattern.test("spu 003")).toBe(false);
    expect(productCodePattern.test("-SPU")).toBe(false);
  });
  it("shows the margin from the reference prices", () => {
    expect(marginNote("125.000", "150.000")).toBe("Margin kotor 16,7% · IDR 25.000");
    expect(marginNote("150.000", "125.000")).toBe("Harga jual di bawah harga beli acuan.");
    expect(marginNote("", "")).toBe("Dipakai sebagai harga bawaan di SO.");
  });
  it("activation readiness ignores the permit and needs shelf life only with expiry", () => {
    expect(productReadiness(ready).every((r) => r.done)).toBe(true);
    expect(productReadiness({ ...ready, shelf_life_days: "" })[1]!.done).toBe(false);
    expect(
      productReadiness({ ...ready, shelf_life_days: "", expiry_required: false })[1]!.done,
    ).toBe(true);
    expect(productReadiness({ ...ready, storage_notes: "" })[0]!.done).toBe(false);
  });
  it("sends no permit when empty and requires number and holder once started", () => {
    expect(permitPayload(permit)).toEqual({ body: {} });
    expect(permitPayload({ ...permit, permit_number: "AKD 1" }).error).toBeDefined();
    expect(
      permitPayload({ ...permit, permit_number: "AKD 1", holder: "PT Uji", evidence: "e1" }).body,
    ).toEqual({
      permit_type: "AKD",
      permit_number: "AKD 1",
      permit_holder: "PT Uji",
      permit_evidence_object_key: "e1",
    });
  });
});
