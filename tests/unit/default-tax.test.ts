import { Prisma, taxDefaults } from "../../packages/database/src";
import { lineAmounts } from "../../packages/backend/src/sales/pricing-controls";
import {
  calculateOperationalTax,
  taxInput,
} from "../../packages/backend/src/finance/operational-tax";
import { OperationalTaxController } from "../../packages/backend/src/finance/operational-tax.controller";
import { REQUIRED_PERMISSIONS } from "../../packages/backend/src/identity/permissions.decorator";

const ppn = {
  rule_id: "00000000-0000-0000-0000-000000000001",
  name: "PPN Penjualan",
  legal_reference: "Master pajak operasional",
  rate: "0.12",
  dpp_factor: "0.9166666667",
  decimal_places: 2,
  rounding: "HALF_UP" as const,
  effect: "ADD",
};

describe("default sales tax", () => {
  it("ships PPN 12% x DPP 11/12 as the sales and purchase defaults", () => {
    const sales = taxDefaults.filter((t) => t.default_for === "SALES");
    const purchase = taxDefaults.filter((t) => t.default_for === "PURCHASE");
    expect(sales).toHaveLength(1);
    expect(purchase).toHaveLength(1);
    expect(sales[0]).toMatchObject({
      name: "PPN Penjualan",
      kind: "PPN",
      effect: "ADD",
      account_code: "2-20500",
      percentage: "12",
      dpp_factor: "0.9166666667",
    });
    expect(purchase[0]).toMatchObject({
      name: "PPN Masukan",
      account_code: "1-10500",
      percentage: "12",
      dpp_factor: "0.9166666667",
    });
  });

  it("computes line PPN as 12% of DPP 11/12 after rounding (effective 11%)", () => {
    const line = { unitPrice: new Prisma.Decimal("1000000"), taxSnapshot: ppn };
    const result = lineAmounts(line, new Prisma.Decimal("1"));
    expect(result.net.toFixed(2)).toBe("1000000.00");
    expect(result.dpp.toFixed(2)).toBe("916666.67");
    expect(result.tax.toFixed(2)).toBe("110000.00");
    expect(result.total.toFixed(2)).toBe("1110000.00");
    const odd = lineAmounts(
      { unitPrice: new Prisma.Decimal("12345.67"), taxSnapshot: ppn },
      new Prisma.Decimal("3"),
    );
    // 37037.01 x 11/12 = 33950.59 (rounded), x 12% = 4074.07 (rounded)
    expect(odd.dpp.toFixed(2)).toBe("33950.59");
    expect(odd.tax.toFixed(2)).toBe("4074.07");
  });

  it("applies the DPP factor to master-tax amounts and keeps factor 1 unchanged", () => {
    expect(calculateOperationalTax("1000000", ppn).toFixed(2)).toBe("110000.00");
    expect(calculateOperationalTax("20", { ...ppn, rate: "0.1", dpp_factor: "1" }).toString()).toBe(
      "2",
    );
    expect(
      calculateOperationalTax("20", {
        rate: "0.02",
        effect: "DEDUCT",
        decimal_places: 2,
        rounding: "HALF_UP",
      }).toString(),
    ).toBe("-0.4");
  });

  it("accepts a DPP factor between 0 and 1 with ten decimals", () => {
    const base = {
      name: "PPN",
      kind: "PPN",
      effect: "ADD",
      account_id: "00000000-0000-4000-8000-000000000001",
      percentage: "12",
      decimal_places: 2,
      rounding: "HALF_UP",
      active: true,
      effective_from: "2026-10-24T00:00:00.000Z",
    };
    expect(taxInput.safeParse({ ...base, dpp_factor: "0.9166666667" }).success).toBe(true);
    expect(taxInput.safeParse({ ...base, dpp_factor: "1" }).success).toBe(true);
    expect(taxInput.safeParse({ ...base, dpp_factor: "0" }).success).toBe(false);
    expect(taxInput.safeParse({ ...base, dpp_factor: "1.5" }).success).toBe(false);
    expect(taxInput.safeParse({ ...base, dpp_factor: 0.9 }).success).toBe(false);
  });

  it("guards the tax master with the Setting > Pajak permissions", () => {
    const required = (method: keyof OperationalTaxController) =>
      Reflect.getMetadata(REQUIRED_PERMISSIONS, OperationalTaxController.prototype[method]);
    expect(required("list")).toEqual(["tax_setting.read"]);
    expect(required("detail")).toEqual(["tax_setting.read"]);
    expect(required("accounts")).toEqual(["tax_setting.read"]);
    expect(required("create")).toEqual(["tax_setting.update"]);
    expect(required("update")).toEqual(["tax_setting.update"]);
    expect(required("setDefault")).toEqual(["tax_setting.update"]);
  });
});
