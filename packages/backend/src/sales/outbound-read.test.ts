import { describe, expect, it } from "vitest";
import { outboundStatus } from "./outbound-read";
import { hasResourcePermission, resourcePermissions } from "../identity/resource-permissions";
import {
  createSuratJalanSchema,
  issueSuratJalanSchema,
  createInvoiceFromSuratJalanSchema,
  createDeliveryNoteSchema,
  issueDeliveryNoteSchema,
  createInvoiceFromDeliveryNoteSchema,
} from "@evflow/contracts";

describe("outbound queue status", () => {
  it("exposes the canonical Surat Jalan command contracts and existing outbound grants", () => {
    expect(resourcePermissions.outbound.suratJalan).toEqual("outbound_shipping");
    expect(resourcePermissions.outbound.suratJalanIssue).toEqual("outbound_shipping");
    expect(() => createSuratJalanSchema.parse({
      sales_order_id: "00000000-0000-4000-8000-000000000001",
      lines: [{ sales_order_line_id: "00000000-0000-4000-8000-000000000002", quantity: "1" }],
    })).not.toThrow();
    expect(() => issueSuratJalanSchema.parse({
      handover_at: "2026-10-29T08:00:00.000Z",
      receiver_name: "Penerima",
      evidence_id: "00000000-0000-4000-8000-000000000004",
      lines: [{ sales_order_line_id: "00000000-0000-4000-8000-000000000002", delivered_quantity: "1" }],
    })).not.toThrow();
    expect(() => createInvoiceFromSuratJalanSchema.parse({
      surat_jalan_id: "00000000-0000-4000-8000-000000000003",
    })).not.toThrow();
    // English API aliases are the same public schemas used by delivery-note handlers.
    expect(createDeliveryNoteSchema).toBe(createSuratJalanSchema);
    expect(issueDeliveryNoteSchema).toBe(issueSuratJalanSchema);
    expect(createInvoiceFromDeliveryNoteSchema).toBe(createInvoiceFromSuratJalanSchema);
    expect(() => createInvoiceFromDeliveryNoteSchema.parse({
      surat_jalan_id: "00000000-0000-4000-8000-000000000003",
    })).not.toThrow();
  });

  it("keeps SO, Surat Jalan and Invoice permissions independent", () => {
    const base = {
      user_id: "00000000-0000-4000-8000-000000000001",
      membership_id: "00000000-0000-4000-8000-000000000002",
      company_id: "00000000-0000-4000-8000-000000000003",
      company_name: "Test",
      display_name: "Test User",
      email: "test@example.com",
      roles: [{ code: "SALES", name: "Sales" }],
    } as const;
    const withSo = { ...base, permissions: [{ code: "sales_order.read", scope_type: "company", scope_id: null }] };
    const withSj = { ...base, permissions: [{ code: "outbound_shipping.read", scope_type: "company", scope_id: null }] };
    const withInvoice = { ...base, permissions: [{ code: "sales_invoice.post", scope_type: "company", scope_id: null }] };
    expect(hasResourcePermission(withSo, "sales_order.read")).toBe(true);
    expect(hasResourcePermission(withSo, "outbound_shipping.read")).toBe(false);
    expect(hasResourcePermission(withSo, "sales_invoice.post")).toBe(false);
    expect(hasResourcePermission(withSj, "outbound_shipping.read")).toBe(true);
    expect(hasResourcePermission(withSj, "sales_order.read")).toBe(false);
    expect(hasResourcePermission(withInvoice, "sales_invoice.post")).toBe(true);
    expect(hasResourcePermission(withInvoice, "outbound_shipping.read")).toBe(false);
  });
  it("rejects missing handover evidence, zero quantities, and duplicate issue lines", () => {
    const base = {
      handover_at: "2026-10-29T08:00:00.000Z",
      receiver_name: "Penerima",
      evidence_id: "00000000-0000-4000-8000-000000000004",
    };
    expect(issueSuratJalanSchema.safeParse({ ...base, lines: [{ sales_order_line_id: "00000000-0000-4000-8000-000000000002", delivered_quantity: "1" }], evidence_id: undefined }).success).toBe(false);
    expect(issueSuratJalanSchema.safeParse({ ...base, lines: [{ sales_order_line_id: "00000000-0000-4000-8000-000000000002", delivered_quantity: "0" }] }).success).toBe(false);
    expect(issueSuratJalanSchema.safeParse({ ...base, lines: [
      { sales_order_line_id: "00000000-0000-4000-8000-000000000002", delivered_quantity: "1" },
      { sales_order_line_id: "00000000-0000-4000-8000-000000000002", delivered_quantity: "1" },
    ] }).success).toBe(false);
    expect(createSuratJalanSchema.safeParse({
      sales_order_id: "00000000-0000-4000-8000-000000000001",
      lines: [
        { sales_order_line_id: "00000000-0000-4000-8000-000000000002", quantity: "1" },
        { sales_order_line_id: "00000000-0000-4000-8000-000000000002", quantity: "1" },
      ],
    }).success).toBe(false);
  });
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
