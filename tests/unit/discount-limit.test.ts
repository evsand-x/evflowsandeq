import { Prisma } from "../../packages/database/src";
import { effectiveDiscountLimit } from "../../packages/backend/src/sales/discount-limit";

const d = (v: string) => new Prisma.Decimal(v);
const base = {
  isAdmin: false,
  personLimit: null,
  roleLimits: [] as Prisma.Decimal[],
  companyDefault: null,
  productLimit: null,
};
const value = (r: ReturnType<typeof effectiveDiscountLimit>) =>
  r === "UNLIMITED" ? r : r.toFixed(4);

describe("effectiveDiscountLimit", () => {
  it("person overrides role", () => {
    expect(
      value(
        effectiveDiscountLimit({
          ...base,
          personLimit: d("2"),
          roleLimits: [d("10")],
          companyDefault: d("7"),
        }),
      ),
    ).toBe("2.0000");
  });
  it("highest role wins", () => {
    expect(
      value(
        effectiveDiscountLimit({
          ...base,
          roleLimits: [d("3"), d("8.5"), d("5")],
          companyDefault: d("1"),
        }),
      ),
    ).toBe("8.5000");
  });
  it("company default only when person and roles are empty", () => {
    expect(value(effectiveDiscountLimit({ ...base, companyDefault: d("4") }))).toBe("4.0000");
    expect(
      value(effectiveDiscountLimit({ ...base, roleLimits: [d("0")], companyDefault: d("4") })),
    ).toBe("0.0000");
  });
  it("product cap wins when smaller", () => {
    expect(
      value(effectiveDiscountLimit({ ...base, personLimit: d("10"), productLimit: d("3") })),
    ).toBe("3.0000");
    expect(
      value(effectiveDiscountLimit({ ...base, personLimit: d("2"), productLimit: d("3") })),
    ).toBe("2.0000");
  });
  it("no limits means zero", () => {
    expect(value(effectiveDiscountLimit(base))).toBe("0.0000");
    expect(value(effectiveDiscountLimit({ ...base, productLimit: d("5") }))).toBe("0.0000");
  });
  it("admin unlimited", () => {
    expect(
      effectiveDiscountLimit({ ...base, isAdmin: true, personLimit: d("1"), productLimit: d("1") }),
    ).toBe("UNLIMITED");
  });
});
