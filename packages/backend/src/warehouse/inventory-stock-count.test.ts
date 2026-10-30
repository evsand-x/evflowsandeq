import { describe, expect, it } from "vitest";
import { calculateStockCountDeltas } from "./inventory-stock-count";

describe("stock count adjustment", () => {
  it("returns only non-zero deltas and rejects negative resulting stock", () => {
    expect(
      calculateStockCountDeltas([
        { stockLotId: "a", expected: "10", counted: "12", unitCost: "5" },
        { stockLotId: "b", expected: "3", counted: "3", unitCost: "8" },
      ]),
    ).toEqual([{ stockLotId: "a", delta: "2", unitCost: "5" }]);
    expect(() =>
      calculateStockCountDeltas([{ stockLotId: "a", expected: "3", counted: "-1", unitCost: "8" }]),
    ).toThrow("COUNT_NEGATIVE");
  });
});
