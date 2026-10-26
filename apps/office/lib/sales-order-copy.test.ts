import { describe, expect, it } from "vitest";
import {
  lineStatusLabel,
  relatedKindLabel,
  orderStatusLabel,
  documentStatusLabel,
} from "./sales-order-copy";

describe("SO detail plain language", () => {
  it.each([
    ["DRAFT", "Draft"],
    ["WAITING_APPROVAL", "Menunggu persetujuan"],
    ["OPEN", "Open"],
    ["PARTIALLY_SHIPPED", "Dikirim sebagian"],
    ["IN_DELIVERY", "Dalam pengiriman"],
    ["COMPLETED", "Selesai"],
    ["CANCELLED", "Dibatalkan"],
  ])("labels order status %s", (code, label) => expect(orderStatusLabel(code!)).toBe(label));
  it.each([
    "PENDING_VERIFICATION",
    "VERIFIED",
    "REJECTED",
    "ISSUED_WAITING_POD",
    "VOID",
    "SUPERSEDED",
  ])("labels document status %s", (code) => {
    expect(documentStatusLabel(code)).not.toBe("Belum tersedia");
    expect(documentStatusLabel(code)).not.toBe(code);
  });
  it.each(["CLOSED", "DONE", "IN_DELIVERY", "READY", "WAITING_STOCK"])("labels line %s", (code) => {
    expect(lineStatusLabel(code)).not.toBe(code);
    expect(lineStatusLabel(code)).not.toBe("Belum tersedia");
    expect(lineStatusLabel(code)).not.toMatch(/snapshot|invariant|fallback|allocation/i);
  });
  it.each([
    "PROFORMA",
    "PICK_SLIP",
    "PACKING_LIST",
    "SURAT_JALAN",
    "POD",
    "INVOICE",
    "CREDIT_NOTE",
    "ADVANCE",
  ])("labels document %s", (code) => {
    expect(relatedKindLabel(code)).not.toBe(code);
    expect(relatedKindLabel(code)).not.toBe("Dokumen");
    expect(relatedKindLabel(code)).not.toMatch(/snapshot|invariant|fallback|allocation/i);
  });
});
