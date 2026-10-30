import { randomUUID } from "node:crypto";
import {
  createDeliveryNote,
  deliveryNoteView,
  getDeliveryNote,
  issueDeliveryNote,
  receiveDeliveryNote,
  updateDeliveryNoteDraft,
} from "../../packages/backend/src/sales/delivery-note";
import { deliveryNoteForm } from "../../packages/backend/src/sales/delivery-note-form";
import { o2cFixture } from "./o2c-release1-fixture";

describe("Surat Jalan form fields (Release 1)", () => {
  it("serves the form, keeps typed header fields and a unique edited number", async () =>
    o2cFixture(async (f) => {
      const form = await deliveryNoteForm(f.c, { salesOrderId: f.order.id }, f.tx);
      expect(form.order.number).toBe(f.order.number);
      expect(form.lines[0]).toMatchObject({
        ordered: "10",
        issued: "0",
        remaining: "10",
        stock: "10",
      });
      expect(form.warehouseId).toBe(f.w.id);
      expect(form.nextNumber).toMatch(/^SJ\./);

      // Without a typed number the server uses the sequence; header fields are stored as typed.
      const first = await createDeliveryNote(
        f.c,
        f.a,
        {
          ...f.input("4"),
          document_date: "2026-10-30",
          ship_date: "2026-10-31",
          warehouse_id: f.w.id,
          freight_amount: "150000",
          carrier_name: "Armada internal",
          vehicle_number: "DD 1234 XX",
          driver_name: "Pengemudi Simulasi",
        },
        randomUUID(),
      );
      expect(deliveryNoteView(first)).toMatchObject({
        number: form.nextNumber,
        documentDate: "2026-10-30",
        shipDate: "2026-10-31",
        freightAmount: "150000",
        carrierName: "Armada internal",
        vehicleNumber: "DD 1234 XX",
        driverName: "Pengemudi Simulasi",
        warehouseId: f.w.id,
      });
      const again = await deliveryNoteForm(f.c, { deliveryNoteId: first.id }, f.tx);
      expect(again.nextNumber).not.toBe(form.nextNumber);
      expect(again.carriers).toEqual(["Armada internal"]);
      expect(again.note?.id).toBe(first.id);

      // A typed number must be unique; a draft may change its own number.
      await expect(
        createDeliveryNote(f.c, f.a, { ...f.input("1"), number: first.number }, randomUUID()),
      ).rejects.toMatchObject({ response: { message: "DELIVERY_NOTE_NUMBER_EXISTS" } });
      const renamed = await updateDeliveryNoteDraft(
        f.c,
        f.a,
        first.id,
        { ...f.input("4"), number: "SJ-UJI-01" },
        randomUUID(),
      );
      expect(renamed.number).toBe("SJ-UJI-01");

      await issueDeliveryNote(f.c, f.a, first.id, {}, randomUUID());
      await receiveDeliveryNote(f.c, f.a, first.id,
        { ...f.handover("4"), receiver_title: "Kepala Gudang RS" }, randomUUID());
      const issued = deliveryNoteView(await getDeliveryNote(f.c, first.id, f.tx));
      expect(issued).toMatchObject({ state: "ISSUED", receiverTitle: "Kepala Gudang RS" });
      const after = await deliveryNoteForm(f.c, { salesOrderId: f.order.id }, f.tx);
      expect(after.lines[0]).toMatchObject({ issued: "4", remaining: "6" });
    }));

  it("bills the typed freight of a Surat Jalan only when the customer pays freight", async () =>
    o2cFixture(async (f) => {
      await f.tx.salesOrder.update({
        where: { id: f.order.id },
        data: {
          freightEstimate: "50000",
          freightTermsSnapshot: {
            payer: "CUSTOMER",
            basis: "PER_SHIPMENT",
            estimate: "50000",
            tax_mode: "NON_TAXABLE",
          },
        },
      });
      const typed = await createDeliveryNote(
        f.c,
        f.a,
        { ...f.input("2"), freight_amount: "75000" },
        randomUUID(),
      );
      expect(typed.snapshot).toMatchObject({ freight_amount: "75000" });
      const estimate = await createDeliveryNote(f.c, f.a, f.input("2"), randomUUID());
      expect(estimate.snapshot).toMatchObject({ freight_amount: "50000" });

      // Ongkir ditanggung perusahaan: nilai diketik tersimpan sebagai biaya kirim, tidak ditagihkan.
      await f.tx.salesOrder.update({
        where: { id: f.order.id },
        data: {
          freightTermsSnapshot: {
            payer: "COMPANY",
            basis: "PER_SHIPMENT",
            estimate: "50000",
            tax_mode: "NON_TAXABLE",
          },
        },
      });
      const company = await createDeliveryNote(
        f.c,
        f.a,
        { ...f.input("2"), freight_amount: "80000" },
        randomUUID(),
      );
      expect(company.freightAmount?.toString()).toBe("80000");
      expect(company.snapshot).toMatchObject({ freight_amount: "0" });
    }));
});
