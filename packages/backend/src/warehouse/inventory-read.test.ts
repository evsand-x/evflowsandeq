import { describe, expect, it } from "vitest";
import { aggregateInventoryRows, buildStockCard } from "./inventory-read";

describe("inventory read projections", () => {
  it("computes available and held stock without leaking negative availability", () => {
    const rows = aggregateInventoryRows(
      [
        {
          productId: "p1",
          quantityOnHand: "10",
          quantityReserved: "3",
          qualityState: "AVAILABLE",
          locatorType: "STORAGE",
          expiryDate: null,
          minimumStock: "12",
          unitCost: "5",
        },
        {
          productId: "p1",
          quantityOnHand: "4",
          quantityReserved: "8",
          qualityState: "HOLD",
          locatorType: "QUARANTINE",
          expiryDate: null,
          minimumStock: "12",
          unitCost: "5",
        },
      ],
      new Date("2026-10-30"),
    );
    expect(rows[0]).toMatchObject({
      productId: "p1",
      total: "14",
      reserved: "11",
      held: "4",
      available: "0",
      minimumStock: "12",
      inventoryValue: "70",
    });
  });

  it("replays stock movements into opening, period totals, and running balance", () => {
    const card = buildStockCard(
      [
        {
          id: "1",
          createdAt: new Date("2026-09-30"),
          kind: "OPENING",
          quantity: "50",
          unitCost: "10",
          sourceType: "OPENING",
          sourceId: "a",
        },
        {
          id: "2",
          createdAt: new Date("2026-10-07"),
          kind: "RECEIPT",
          quantity: "60",
          unitCost: "11",
          sourceType: "GR",
          sourceId: "b",
        },
        {
          id: "3",
          createdAt: new Date("2026-10-08"),
          kind: "DISPATCH",
          quantity: "24",
          unitCost: "10",
          sourceType: "SJ",
          sourceId: "c",
        },
      ],
      { from: new Date("2026-10-01"), to: new Date("2026-10-31") },
    );
    expect(card.summary).toMatchObject({
      opening: "50",
      incoming: "60",
      outgoing: "24",
      closing: "86",
    });
    expect(card.rows.map((r) => r.balance)).toEqual(["50", "110", "86"]);
  });
});
