import { describe, expect, it } from "vitest";
import {
  lineStatusLabel,
  relatedKindLabel,
  orderStatusLabel,
  documentStatusLabel,
  orderDocumentStatus,
  shippingLabel,
  billingLabel,
} from "./sales-order-copy";

describe("SO detail plain language", () => {
  it.each([
    ["DRAFT", "Draft"],
    ["WAITING_APPROVAL", "Menunggu persetujuan"],
    ["OPEN", "Diajukan"],
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

describe("SO list columns", () => {
  it("keeps submitted orders as Diajukan while delivery progress has its own column", () => {
    expect(orderDocumentStatus("PARTIALLY_SHIPPED").label).toBe("Diajukan");
    expect(orderDocumentStatus("COMPLETED").label).toBe("Diajukan");
    expect(orderDocumentStatus("DRAFT").label).toBe("Draft");
    expect(orderDocumentStatus("CANCELLED")).toEqual({ label: "Dibatalkan", tone: "danger" });
  });
  it("formats shipping from the server summary", () => {
    expect(shippingLabel(null).label).toBe("—");
    expect(
      shippingLabel({
        status: "PARTIAL",
        remainingQuantity: "1064.5000",
        remainingUnit: "Box",
        draftDeliveryNotes: 0,
      }).label,
    ).toBe("Sebagian · sisa 1.064,5 Box");
    expect(
      shippingLabel({
        status: "NOT_SHIPPED",
        remainingQuantity: "10",
        remainingUnit: "Box",
        draftDeliveryNotes: 1,
      }).label,
    ).toBe("Belum dikirim · ada draft SJ");
    expect(
      shippingLabel({
        status: "SHIPPED",
        remainingQuantity: "0",
        remainingUnit: null,
        draftDeliveryNotes: 0,
      }).label,
    ).toBe("Terkirim penuh");
  });
  it.each([
    ["UNINVOICED", "Belum diinvoice"],
    ["UNPAID", "Belum dibayar"],
    ["PARTIAL", "Dibayar sebagian"],
    ["PAID", "Lunas"],
    ["NONE", "—"],
  ] as const)("labels billing %s", (status, label) =>
    expect(billingLabel({ status, invoiceCount: 1, uninvoicedDeliveryNotes: 0 }).label).toBe(label),
  );
});
