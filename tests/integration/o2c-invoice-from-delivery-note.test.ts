import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { createInvoiceFromDeliveryNoteSchema } from "@evflow/contracts";

describe("Release 1 invoice source", () => {
  it("exposes an idempotent command for an issued Surat Jalan", () => {
    expect(typeof OtcPtpService.prototype.createInvoiceFromDeliveryNote).toBe("function");
    expect(
      createInvoiceFromDeliveryNoteSchema.parse({
        surat_jalan_id: "00000000-0000-4000-8000-000000000003",
      }),
    ).toEqual({ surat_jalan_id: "00000000-0000-4000-8000-000000000003" });
  });

  it("rejects direct sales-order or legacy POD sources at the Release 1 contract boundary", () => {
    expect(() => createInvoiceFromDeliveryNoteSchema.parse({ sales_order_id: "00000000-0000-4000-8000-000000000003" })).toThrow();
    expect(() => createInvoiceFromDeliveryNoteSchema.parse({ delivery_receipt_id: "00000000-0000-4000-8000-000000000003" })).toThrow();
  });
});
