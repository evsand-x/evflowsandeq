import { describe, expect, it } from "vitest";
import {
  deliveryNoteStatus,
  handoverText,
  quantityText,
  remainingQuantity,
  releaseOneOutboundStages,
} from "./surat-jalan-utils";

describe("Release 1 Surat Jalan navigation", () => {
  it("calculates remaining quantity after issued deliveries", () => {
    expect(remainingQuantity("10", "3.5")).toBe("6.5");
    expect(remainingQuantity("2", "2")).toBe("0");
  });
  it("only exposes Surat Jalan in outbound navigation", () => {
    expect(releaseOneOutboundStages.map((stage) => stage.label)).toEqual(["Surat Jalan"]);
  });
});

describe("Surat Jalan list copy", () => {
  it("labels document status like the mockup", () => {
    expect(deliveryNoteStatus("DRAFT")).toEqual({ label: "Draft", tone: "warning" });
    expect(deliveryNoteStatus("ISSUED")).toEqual({ label: "Terbit", tone: "success" });
    expect(deliveryNoteStatus("CANCELLED")).toEqual({ label: "Dibatalkan", tone: "danger" });
  });
  it("shows handover time or a draft hint", () => {
    expect(handoverText(null)).toBe("Belum diserahkan");
    expect(handoverText("2026-10-28T02:40:00.000Z", "Asia/Makassar")).toBe("28 Okt 2026, 10.40");
  });
  it("groups quantities and keeps the unit", () => {
    expect(quantityText("1250.5000000000", "Box")).toBe("1.250,5 Box");
    expect(quantityText("86", null)).toBe("86 unit");
  });
});
