import { describe, expect, it } from "vitest";
import { outboundStatus } from "./outbound-read";

describe("outbound queue status", () => {
  it("never advertises a cancelled batch as actionable", () => {
    for (const stage of ["picking", "checking", "shipping", "pod"]) {
      expect(
        outboundStatus(stage, { state: "CANCELLED", pickList: { state: "OPEN", lines: [] } }),
      ).toBe("Dibatalkan");
    }
  });
  it("marks delivered shipments complete and partial POD separately", () => {
    expect(outboundStatus("shipping", { state: "DELIVERED" })).toBe("Selesai");
    expect(outboundStatus("pod", { state: "PARTIALLY_DELIVERED" })).toBe("Sebagian diterima");
  });
  it("holds checking on a precision-level picking shortage", () => {
    const row = {
      state: "ALLOCATED",
      pickList: {
        state: "PICKED",
        lines: [{ assignedQuantity: "1.0000000001", pickedQuantity: "1" }],
      },
    };
    expect(outboundStatus("picking", row)).toBe("Sebagian diambil");
    expect(outboundStatus("checking", row)).toBe("Ditahan");
  });
});
