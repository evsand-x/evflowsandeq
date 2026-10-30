import { randomUUID } from "node:crypto";
import { createSalesOrderSchema, salesOrderDisplayStatusSchema } from "@evflow/contracts";
import { operationalPolicyCatalog } from "@evflow/database";
import { validatePolicyValue } from "../../packages/backend/src/administration/policy-validator";

const minimal = () => ({
  customer_id: randomUUID(),
  lines: [{ product_id: randomUUID(), quantity: "1", unit_price: "1000" }],
});

describe("Sales Order header contract", () => {
  it("accepts minimal SO without reference, address and evidence", () => {
    expect(createSalesOrderSchema.safeParse(minimal()).success).toBe(true);
  });

  it("accepts header fields and per-line warehouse", () => {
    const input = {
      ...minimal(),
      order_date: "2026-10-25",
      payment_term_code: "TEMPO_30",
      salesperson_id: randomUUID(),
      warehouse_id: randomUUID(),
    };
    const data = {
      ...input,
      lines: input.lines.map((line) => ({ ...line, warehouse_id: randomUUID() })),
    };
    expect(createSalesOrderSchema.parse(data)).toMatchObject(data);
  });

  it.each(["25/10/2026", "2026-02-30"])("rejects invalid order_date %s", (order_date) => {
    expect(createSalesOrderSchema.safeParse({ ...minimal(), order_date }).success).toBe(false);
  });

  it("accepts blank optional reference and address for clearing", () => {
    expect(
      createSalesOrderSchema.parse({
        ...minimal(),
        customer_reference: " ",
        delivery_address: " ",
      }),
    ).toMatchObject({ customer_reference: "", delivery_address: "" });
  });

  it.each(["payment_term_code", "salesperson_id", "warehouse_id"])(
    "rejects invalid %s",
    (field) => {
      expect(createSalesOrderSchema.safeParse({ ...minimal(), [field]: "" }).success).toBe(false);
    },
  );

  it("lists seven display statuses", () => {
    expect(salesOrderDisplayStatusSchema.options).toEqual([
      "DRAFT",
      "WAITING_APPROVAL",
      "OPEN",
      "PARTIALLY_SHIPPED",
      "IN_DELIVERY",
      "COMPLETED",
      "CANCELLED",
    ]);
  });

  it("catalog has OPS-FLX-10..13 with validated defaults", () => {
    for (const [code, value] of [
      ["OPS-FLX-10", null],
      ["OPS-FLX-11", false],
      ["OPS-FLX-12", false],
      ["OPS-FLX-13", false],
    ] as const) {
      const entry = operationalPolicyCatalog.find((policy) => policy.code === code);
      expect(entry).toBeDefined();
      expect(entry?.default).toBe(value);
      expect(entry?.group).toBe("sales");
      expect(entry?.domain).toBe("administration");
      expect(
        validatePolicyValue(value, entry!.schema as Parameters<typeof validatePolicyValue>[1]),
      ).toEqual([]);
    }
  });
});
