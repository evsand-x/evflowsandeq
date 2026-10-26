import { Prisma } from "@evflow/database";
import { orderView } from "../../packages/backend/src/sales/order-view";
import {
  estimatedDueDate,
  orderDisplayStatus,
} from "../../packages/backend/src/sales/order-status";

const d = (value: string) => new Prisma.Decimal(value);
const line = (ordered = "10", accepted = "0", inTransit = "0", closed = "0") => ({
  ordered: d(ordered),
  accepted: d(accepted),
  inTransit: d(inTransit),
  closed: d(closed),
});

describe("SO display status", () => {
  it("preserves precision when read projection combines split POD allocations", () => {
    const result = orderView({
      state: "OPEN",
      lines: [
        {
          orderedQuantity: d("9999999999999.0000000001"),
          allocatedQuantity: d("9999999999999.0000000001"),
          closedQuantity: d("0"),
          backorderQuantity: d("0"),
          unitPrice: d("0"),
          taxSnapshot: null,
          allocations: [
            {
              acceptedQuantity: d("9999999999999"),
              inTransitQuantity: d("0"),
              returnedQuantity: d("0"),
            },
            {
              acceptedQuantity: d("0.0000000001"),
              inTransitQuantity: d("0"),
              returnedQuantity: d("0"),
            },
          ],
        },
      ],
    });
    expect(result.displayStatus).toBe("COMPLETED");
  });
  it.each([
    ["CANCELLED", true, [line()], "CANCELLED"],
    ["DRAFT", true, [line()], "WAITING_APPROVAL"],
    ["DRAFT", false, [line()], "DRAFT"],
    ["CLOSED", false, [line("30", "0", "0", "20")], "OPEN"],
    ["CLOSED", false, [line("30", "0", "10", "20")], "IN_DELIVERY"],
    ["CLOSED", false, [line("30", "10", "0", "20")], "COMPLETED"],
    ["COMPLETED", false, [line()], "COMPLETED"],
    ["OPEN", false, [line("10", "10")], "COMPLETED"],
    ["OPEN", false, [line("10", "2", "8")], "IN_DELIVERY"],
    ["OPEN", false, [line("10", "2", "3")], "PARTIALLY_SHIPPED"],
    ["OPEN", false, [line()], "OPEN"],
  ] as const)("projects %s / pending %s as %s", (state, pendingException, lines, expected) => {
    expect(orderDisplayStatus({ state, pendingException, lines: [...lines] })).toBe(expected);
  });
  it("keeps returned quantities outstanding for resending", () => {
    // A dispatch of 10 with 7 accepted and 3 returned has no remaining in-transit quantity.
    expect(
      orderDisplayStatus({ state: "OPEN", pendingException: false, lines: [line("10", "7")] }),
    ).toBe("PARTIALLY_SHIPPED");
  });
  it("subtracts closed quantities before checking accepted quantities", () => {
    expect(
      orderDisplayStatus({
        state: "OPEN",
        pendingException: false,
        lines: [line("10", "7", "0", "3")],
      }),
    ).toBe("COMPLETED");
  });
  it("compares each line so excess on one never covers another", () => {
    expect(
      orderDisplayStatus({
        state: "OPEN",
        pendingException: false,
        lines: [line("10", "20"), line()],
      }),
    ).toBe("PARTIALLY_SHIPPED");
  });
  it("does not complete an empty open order", () => {
    expect(orderDisplayStatus({ state: "OPEN", pendingException: false, lines: [] })).toBe("OPEN");
  });
  it("preserves decimal precision at the fulfillment boundary", () => {
    expect(
      orderDisplayStatus({
        state: "OPEN",
        pendingException: false,
        lines: [line("9999999999999.0000000001", "9999999999999")],
      }),
    ).toBe("PARTIALLY_SHIPPED");
  });
});

describe("estimated SO due date", () => {
  it("adds TEMPO days as calendar days without mutating the order date", () => {
    const date = new Date("2026-10-25T00:00:00.000Z");
    expect(
      estimatedDueDate(date, { code: "TEMPO_30", label: "30 days", days: 30, kind: "TEMPO" }),
    ).toBe("2026-11-24");
    expect(date.toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });
  it.each(["COD", "PREPAY"] as const)("returns no estimate for %s", (kind) => {
    expect(
      estimatedDueDate(new Date("2026-10-25"), { code: kind, label: kind, days: 0, kind }),
    ).toBeNull();
  });
  it("returns no estimate without a term", () => {
    expect(estimatedDueDate(new Date("2026-10-25"), null)).toBeNull();
  });
});
