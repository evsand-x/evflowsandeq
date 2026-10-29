import { describe, expect, it } from "vitest";
import { remainingQuantity, releaseOneOutboundStages } from "./surat-jalan-utils";

describe("Release 1 Surat Jalan navigation", () => {
  it("calculates remaining quantity after issued deliveries", () => {
    expect(remainingQuantity("10", "3.5")).toBe("6.5");
    expect(remainingQuantity("2", "2")).toBe("0");
  });
  it("only exposes Surat Jalan in outbound navigation", () => {
    expect(releaseOneOutboundStages.map((stage) => stage.label)).toEqual(["Surat Jalan"]);
  });
});
