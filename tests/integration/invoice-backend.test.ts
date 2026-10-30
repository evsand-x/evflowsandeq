import { randomUUID } from "node:crypto";
import { o2cFixture } from "./o2c-release1-fixture";
import {
  createDeliveryNote,
  issueDeliveryNote,
} from "../../packages/backend/src/sales/delivery-note";
import * as invoices from "../../packages/backend/src/finance/invoice";

async function source(f: Parameters<Parameters<typeof o2cFixture>[0]>[0]) {
  const note = await createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
  await issueDeliveryNote(
    f.c,
    f.a,
    note.id,
    {},
    randomUUID(),
  );
  return note;
}
describe("Invoice draft and posting from issued Surat Jalan", () => {
  it("posts on the entered business date in a negative UTC timezone", async () =>
    o2cFixture(async (f) => {
      await f.tx.company.update({ where: { id: f.c }, data: { timezone: "America/New_York" } });
      const note = await source(f);
      const draft = await invoices.saveInvoiceDraft(
        f.c,
        f.a,
        { surat_jalan_id: note.id, invoice_date: "2026-10-30" },
        randomUUID(),
      );
      await invoices.submitInvoice(f.c, f.a, draft.id, 1, randomUUID());
      const journal = await f.tx.financeJournal.findFirstOrThrow({ where: { sourceId: draft.id } });
      expect(journal.businessDate.toISOString().slice(0, 10)).toBe("2026-10-30");
    }));
  it("uses issuance day in company timezone, preserves source snapshot and posts AR once", async () =>
    o2cFixture(async (f) => {
      const note = await source(f);
      const actual = await f.tx.deliveryNote.findUniqueOrThrow({ where: { id: note.id } });
      const company = await f.tx.company.findUniqueOrThrow({ where: { id: f.c } });
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: company.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(actual.issuedAt!);
      const due = new Date(day);
      due.setUTCDate(due.getUTCDate() + 30);
      const input = {
        surat_jalan_id: note.id,
        number: "INV-MANUAL-01",
        invoice_date: "2026-10-30",
        notes: "Bayar sesuai rekening",
      };
      const key = randomUUID();
      const draft = await invoices.saveInvoiceDraft(f.c, f.a, input, key);
      expect(draft.state).toBe("DRAFT");
      expect(draft.outstandingAmount.toString()).toBe("0");
      expect(draft.dueDate?.toISOString().slice(0, 10)).toBe(due.toISOString().slice(0, 10));
      expect(draft.total?.toString()).toBe("44");
      expect((await invoices.saveInvoiceDraft(f.c, f.a, input, key)).id).toBe(draft.id);
      expect(await f.tx.financeJournal.count({ where: { sourceId: draft.id } })).toBe(0);
      await expect(invoices.saveInvoiceDraft(f.c, f.a, input, randomUUID())).rejects.toThrow(
        "DELIVERY_NOTE_ALREADY_INVOICED",
      );
      await expect(
        invoices.saveInvoiceDraft(f.c, f.a, { ...input, version: 99 }, randomUUID(), draft.id),
      ).rejects.toThrow("INVOICE_VERSION_CONFLICT");
      const edited = await invoices.saveInvoiceDraft(
        f.c,
        f.a,
        { ...input, number: "INV-EDITED", version: 1 },
        randomUUID(),
        draft.id,
      );
      await f.tx.customer.update({
        where: { id: f.order.customerId },
        data: { name: "Changed after draft" },
      });
      const posted = await invoices.submitInvoice(f.c, f.a, draft.id, edited.version, randomUUID());
      expect(posted).toMatchObject({ state: "POSTED", number: "INV-EDITED", notes: input.notes });
      expect(posted.outstandingAmount.toString()).toBe("44");
      expect(posted.issuedSnapshot).not.toMatchObject({
        customer: { name: "Changed after draft" },
      });
      await invoices.submitInvoice(f.c, f.a, draft.id, posted.version, randomUUID());
      expect(await f.tx.financeJournal.count({ where: { sourceId: draft.id } })).toBe(1);
      const journal = await f.tx.financeJournal.findFirstOrThrow({
        where: { sourceId: draft.id },
        include: { lines: true },
      });
      expect(journal.businessDate.toISOString().slice(0, 10)).toBe("2026-10-30");
      expect(journal.lines.map((l) => l.ledgerKind).sort()).toEqual(["AR", "UNBILLED_AR"]);
      await expect(
        invoices.saveInvoiceDraft(
          f.c,
          f.a,
          { ...input, version: posted.version },
          randomUUID(),
          draft.id,
        ),
      ).rejects.toThrow("INVOICE_NOT_DRAFT");
    }));
  it("rejects draft SJ, foreign company, duplicate number, closed period and tampered commercial fields", async () =>
    o2cFixture(async (f) => {
      const draftNote = await createDeliveryNote(f.c, f.a, f.input("2"), randomUUID());
      await expect(
        invoices.saveInvoiceDraft(f.c, f.a, { surat_jalan_id: draftNote.id }, randomUUID()),
      ).rejects.toThrow("DELIVERY_NOTE_NOT_ISSUED");
      const note = await source(f);
      await expect(
        invoices.saveInvoiceDraft(randomUUID(), f.a, { surat_jalan_id: note.id }, randomUUID()),
      ).rejects.toThrow();
      await expect(
        invoices.saveInvoiceDraft(f.c, f.a, { surat_jalan_id: note.id, total: "1" }, randomUUID()),
      ).rejects.toThrow();
      const one = await invoices.saveInvoiceDraft(
        f.c,
        f.a,
        { surat_jalan_id: note.id, number: "UNIQUE-INV" },
        randomUUID(),
      );
      await issueDeliveryNote(f.c, f.a, draftNote.id, {}, randomUUID());
      await expect(
        invoices.saveInvoiceDraft(
          f.c,
          f.a,
          { surat_jalan_id: draftNote.id, number: "UNIQUE-INV" },
          randomUUID(),
        ),
      ).rejects.toThrow("INVOICE_NUMBER_EXISTS");
      await f.tx.financePeriod.updateMany({ where: { companyId: f.c }, data: { state: "CLOSED" } });
      await expect(invoices.submitInvoice(f.c, f.a, one.id, 1, randomUUID())).rejects.toThrow(
        "FINANCE_PERIOD_NOT_OPEN",
      );
      expect((await f.tx.salesInvoice.findUniqueOrThrow({ where: { id: one.id } })).state).toBe(
        "DRAFT",
      );
    }));
});
