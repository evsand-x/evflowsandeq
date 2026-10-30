import { describe, expect, it } from "vitest";
import {
  confirmPodSchema,
  createSalesOrderSchema,
  openingStockSchema,
  pickListConfirmSchema,
  createPurchaseOrderSchema,
  createSupplierInvoiceSchema,
  createCustomerReceiptSchema,
  createCustomerReturnSchema,
  receivePurchaseOrderSchema,
} from "./otc-ptp";

describe("OTC/P2P contracts", () => {
  it("requires positive decimal quantities and UUID references", () => {
    expect(
      openingStockSchema.safeParse({
        product_id: "bad",
        warehouse_id: "bad",
        locator_id: "bad",
        batch_no: "B1",
        quantity: "0",
        unit_cost: "10",
      }).success,
    ).toBe(false);
  });
  it("keeps all SO lines as decimal strings", () => {
    const parsed = createSalesOrderSchema.parse({
      customer_id: "00000000-0000-0000-0000-000000000001",
      customer_reference: "SP-TEST",
      delivery_address: "Alamat uji",
      evidence_id: "00000000-0000-0000-0000-000000000003",
      lines: [
        {
          product_id: "00000000-0000-0000-0000-000000000002",
          quantity: "2.5000000000",
          unit_price: "100.00",
        },
      ],
    });
    expect(parsed.lines[0]!.quantity).toBe("2.5000000000");
  });
  it("rejects a receipt without lines", () => {
    expect(
      receivePurchaseOrderSchema.safeParse({
        locator_id: "00000000-0000-0000-0000-000000000001",
        lines: [],
      }).success,
    ).toBe(false);
  });
  it("requires actual POD quantities per allocation", () => {
    expect(
      confirmPodSchema.safeParse({
        receiver_name: "Penerima uji",
        evidence_id: "00000000-0000-0000-0000-000000000003",
        lines: [
          {
            fulfillment_allocation_id: "00000000-0000-0000-0000-000000000001",
            accepted_quantity: "1.25",
          },
        ],
      }).success,
    ).toBe(true);
    expect(confirmPodSchema.safeParse({ accepted_at: new Date().toISOString() }).success).toBe(
      false,
    );
  });
  it("validates hardening policy and pick/check payloads", () => {
    expect(
      pickListConfirmSchema.safeParse({
        lines: [
          {
            pick_list_line_id: "00000000-0000-0000-0000-000000000001",
            picked_quantity: "2",
          },
        ],
      }).success,
    ).toBe(true);
  });
  it("requires PO lines to reference approved PR lines", () => {
    expect(
      createPurchaseOrderSchema.safeParse({
        supplier_id: "00000000-0000-0000-0000-000000000001",
        warehouse_id: "00000000-0000-0000-0000-000000000002",
        lines: [
          {
            purchase_request_line_id: "00000000-0000-0000-0000-000000000003",
            quantity: "2",
            unit_cost: "10",
          },
        ],
      }).success,
    ).toBe(true);
  });
  it("keeps supplier invoice matching quantities and prices decimal", () => {
    const parsed = createSupplierInvoiceSchema.parse({
      supplier_invoice_number: "SUP-001",
      invoice_date: "2026-09-30",
      due_date: "2026-10-30",
      tax_amount: "110",
      lines: [
        {
          purchase_order_line_id: "00000000-0000-0000-0000-000000000004",
          quantity: "2.5",
          unit_cost: "1000",
        },
      ],
    });
    expect(parsed.lines[0]!.quantity).toBe("2.5");
  });
  it("validates customer receipt amounts and optional prepayment batch", () => {
    const parsed = createCustomerReceiptSchema.parse({
      bank_account_id: "00000000-0000-0000-0000-000000000009",
      amount: "1500.25",
      fulfillment_batch_id: "00000000-0000-0000-0000-000000000005",
      evidence_id: "00000000-0000-0000-0000-000000000003",
      bank_reference: "MUTASI-TEST",
    });
    expect(parsed.amount).toBe("1500.25");
  });
  it("requires return lines to target a quarantine locator", () => {
    expect(
      createCustomerReturnSchema.safeParse({
        reason: "Barang rusak",
        lines: [
          {
            delivery_receipt_line_id: "00000000-0000-0000-0000-000000000006",
            quantity: "1",
            quarantine_locator_id: "00000000-0000-0000-0000-000000000007",
            batch_no: "B1",
          },
        ],
      }).success,
    ).toBe(true);
  });
});
