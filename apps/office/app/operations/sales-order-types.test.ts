import { effectiveTaxPercent, taxLabel } from "./sales-order-types";

describe("PPN shown on SO screens", () => {
  it("shows the effective rate: 12% x DPP 11/12 is 11%", () => {
    expect(effectiveTaxPercent("12", "0.9166666667")).toBe("11");
    expect(effectiveTaxPercent("11")).toBe("11");
  });
  it("labels a stored tax snapshot with its effective rate", () => {
    expect(taxLabel({ rate: "0.12", dpp_factor: "0.9166666667" })).toBe("11%");
    expect(taxLabel({ rate: "0.1" })).toBe("10%");
    expect(taxLabel(null)).toBe("Belum ditetapkan");
  });
});
