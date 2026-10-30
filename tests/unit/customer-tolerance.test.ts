import { readFileSync } from "node:fs";
import { createCustomerSchema, updateCustomerSchema } from "@evflow/contracts";

describe("retired customer field payment_tolerance_days", () => {
  it("is refused when it carries a number, and still tolerated when absent or null", () => {
    const base = { name: "PT Uji", primary_address: "Alamat" };
    expect(createCustomerSchema.safeParse({ ...base, payment_tolerance_days: 7 }).success).toBe(
      false,
    );
    expect(createCustomerSchema.safeParse({ ...base }).success).toBe(true);
    expect(createCustomerSchema.safeParse({ ...base, payment_tolerance_days: null }).success).toBe(
      true,
    );
    expect(
      updateCustomerSchema.safeParse({ ...base, version: 1, payment_tolerance_days: 7 }).success,
    ).toBe(false);
  });
  it("is no longer part of the customer form", () => {
    const form = readFileSync("apps/office/app/master-data/customers/customer-form.tsx", "utf8");
    expect(form).not.toContain("payment_tolerance_days");
    expect(form).not.toContain("Toleransi hari");
  });
});
