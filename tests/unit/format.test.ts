import { formatMoney, formatQuantity, setFormatterDefaults } from "../../apps/office/lib/format";
import type { NumberFormat } from "@evflow/contracts";

const fmt: NumberFormat = {
  currency: "IDR",
  thousand_separator: ".",
  decimal_separator: ",",
  money_decimals: 0,
  quantity_decimals: 2,
};

describe("number formatting", () => {
  it("formats rupiah from decimal string without float drift", () => {
    expect(formatMoney("1234567.5", fmt)).toBe("Rp 1.234.568");
  });
  it("keeps large values exact", () => {
    expect(formatMoney("12345678901234.49", fmt)).toBe("Rp 12.345.678.901.234");
  });
  it("negative", () => {
    expect(formatMoney("-2500", fmt)).toBe("-Rp 2.500");
  });
  it("rounds tiny negatives to plain zero", () => {
    expect(formatMoney("-0.4", fmt)).toBe("Rp 0");
  });
  it("empty", () => {
    expect(formatMoney(null, fmt)).toBe("Belum tersedia");
  });
  it("quantity", () => {
    expect(formatQuantity("10.5", fmt)).toBe("10,50");
  });
  it("uses defaults set from preferences", () => {
    setFormatterDefaults({ ...fmt, money_decimals: 2 });
    expect(formatMoney("1500.255")).toBe("Rp 1.500,26");
  });
});
