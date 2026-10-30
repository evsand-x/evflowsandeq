import { randomUUID } from "node:crypto";
import { o2cFixture } from "./o2c-release1-fixture";
import {
  createDeliveryNote,
  issueDeliveryNote,
} from "../../packages/backend/src/sales/delivery-note";
import { saveInvoiceDraft, submitInvoice } from "../../packages/backend/src/finance/invoice";
import * as reads from "../../packages/backend/src/finance/invoice-read";

it("lists draft and posted invoices, searches SJ, filters customers, keeps receipt details private", async () =>
  o2cFixture(async (f) => {
    const note = await createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
    await issueDeliveryNote(f.c, f.a, note.id, {}, randomUUID());
    expect((await reads.invoiceCandidates(f.c, {}, f.tx)).rows.map((r) => r.id)).toEqual([note.id]);
    const form = await reads.invoiceForm(f.c, { deliveryNoteId: note.id }, f.tx);
    expect(form.nextNumber).toMatch(/^INV\./);
    expect(form.source.total.toString()).toBe("44");
    const draft = await saveInvoiceDraft(f.c, f.a, { surat_jalan_id: note.id }, randomUUID());
    expect((await reads.invoiceCandidates(f.c, {}, f.tx)).total).toBe(0);
    let list = await reads.invoiceList(f.c, { page: 1, search: note.number, tab: "ALL" }, f.tx);
    expect(list.total).toBe(1);
    expect(list.summary.DRAFT).toBe(1);
    expect(list.rows[0]?.status).toBe("DRAFT");
    await submitInvoice(f.c, f.a, draft.id, 1, randomUUID());
    list = await reads.invoiceList(f.c, { page: 1, search: note.number, tab: "UNPAID" }, f.tx);
    expect(list.rows[0]).toMatchObject({ id: draft.id, status: "UNPAID" });
    expect(
      (
        await reads.invoiceList(
          f.c,
          { page: 1, search: "", tab: "ALL", customer_id: randomUUID() },
          f.tx,
        )
      ).total,
    ).toBe(0);
    const detail = await reads.invoiceDetail(f.c, draft.id, false, f.tx);
    expect(detail).not.toHaveProperty("payments");
    expect(detail.snapshot).toMatchObject({ delivery_note_number: note.number });
    await expect(reads.invoiceDetail(randomUUID(), draft.id, true, f.tx)).rejects.toThrow();
    expect(await reads.invoiceDetail(f.c, draft.id, true, f.tx)).toHaveProperty("payments", []);
  }));
