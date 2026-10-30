import { randomUUID } from "node:crypto";
import { o2cFixture } from "./o2c-release1-fixture";
import * as notes from "../../packages/backend/src/sales/delivery-note";

describe("Separate Surat Jalan issue and receipt", () => {
  it("preserves historical handover and rejects recording it again", async () =>
    o2cFixture(async (f) => {
      const draft = await notes.createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
      const old = f.handover("4");
      // Historical fixture models the pre-separation immutable issue contract.
      await f.tx.deliveryNoteLine.updateMany({
        where: { deliveryNoteId: draft.id },
        data: { deliveredQuantity: "4" },
      });
      await f.tx.deliveryNote.update({
        where: { id: draft.id },
        data: {
          state: "ISSUED",
          issuedAt: new Date(old.handover_at),
          issuedById: f.a,
          issueIdempotencyKey: randomUUID(),
          handoverAt: new Date(old.handover_at),
          receiverName: old.receiver_name,
          evidenceId: old.evidence_id,
          handoverSnapshot: old,
        },
      });
      expect(
        notes.deliveryNoteView(await notes.getDeliveryNote(f.c, draft.id, f.tx)).receipt,
      ).toMatchObject({
        receiverName: "Receiver",
        evidenceId: old.evidence_id,
        lines: old.lines,
      });
      await expect(
        notes.receiveDeliveryNote(f.c, f.a, draft.id, f.handover(), randomUUID()),
      ).rejects.toThrow("DELIVERY_NOTE_ALREADY_RECEIVED");
    }));
  it("keeps company-paid freight out of the issued invoice snapshot", async () =>
    o2cFixture(async (f) => {
      const draft = await notes.createDeliveryNote(
        f.c,
        f.a,
        { ...f.input("4"), freight_amount: "50000" },
        randomUUID(),
      );
      const before = draft.snapshot as { freight_amount: string };
      const issued = await notes.issueDeliveryNote(f.c, f.a, draft.id, {}, randomUUID());
      expect(issued.snapshot).toMatchObject({ freight_amount: before.freight_amount });
      expect((issued.snapshot as { freight_amount: string }).freight_amount).toBe("0");
    }));
  it("records a discrepancy once without changing the issued source, stock or journals", async () =>
    o2cFixture(async (f) => {
      const draft = await notes.createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
      await notes.issueDeliveryNote(f.c, f.a, draft.id, {}, randomUUID());
      const before = await f.tx.deliveryNote.findUniqueOrThrow({ where: { id: draft.id } });
      const payload = {
        ...f.handover("3"),
        lines: [{ ...f.handover("3").lines[0]!, discrepancy_reason: "Kemasan rusak" }],
      };
      const key = randomUUID();
      const receipt = await notes.receiveDeliveryNote(f.c, f.a, draft.id, payload, key);
      expect(receipt.receiverName).toBe("Receiver");
      expect((await notes.receiveDeliveryNote(f.c, f.a, draft.id, payload, key)).id).toBe(
        receipt.id,
      );
      await expect(
        notes.receiveDeliveryNote(f.c, f.a, draft.id, payload, randomUUID()),
      ).rejects.toThrow("DELIVERY_NOTE_ALREADY_RECEIVED");
      expect(await f.tx.deliveryNote.findUniqueOrThrow({ where: { id: draft.id } })).toEqual(
        before,
      );
      const view = notes.deliveryNoteView(await notes.getDeliveryNote(f.c, draft.id, f.tx));
      expect(view.receiverName).toBe("Receiver");
      expect(view.receipt?.lines[0]?.delivered_quantity).toBe("3");
      expect(view.lines[0]!.deliveredQuantity).toBe("4");
      expect(
        (
          await f.tx.stockLot.findUniqueOrThrow({ where: { id: f.lot.id } })
        ).quantityOnHand.toString(),
      ).toBe("6");
      expect(await f.tx.financeJournal.count({ where: { companyId: f.c } })).toBe(1);
      expect(await f.tx.inventoryMovement.count({ where: { companyId: f.c } })).toBe(1);
      expect(
        await f.tx.auditEvent.count({
          where: { companyId: f.c, action: "delivery_note.received" },
        }),
      ).toBe(1);
      await f.tx.$executeRawUnsafe("SAVEPOINT receipt_immutability");
      await expect(
        f.tx.deliveryNoteReceipt.update({
          where: { id: receipt.id },
          data: { receiverName: "Changed" },
        }),
      ).rejects.toThrow("DELIVERY_NOTE_RECEIPT_IMMUTABLE");
      await f.tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT receipt_immutability");
      await f.tx.$executeRawUnsafe("RELEASE SAVEPOINT receipt_immutability");
    }));

  it("rejects draft, foreign scope, bad evidence, excess quantities and early dates", async () =>
    o2cFixture(async (f) => {
      const draft = await notes.createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
      await expect(
        notes.receiveDeliveryNote(f.c, f.a, draft.id, f.handover(), randomUUID()),
      ).rejects.toThrow("DELIVERY_NOTE_NOT_ISSUED");
      await notes.issueDeliveryNote(f.c, f.a, draft.id, {}, randomUUID());
      await expect(
        notes.receiveDeliveryNote(randomUUID(), f.a, draft.id, f.handover(), randomUUID()),
      ).rejects.toThrow();
      await expect(
        notes.receiveDeliveryNote(
          f.c,
          f.a,
          draft.id,
          { ...f.handover(), evidence_id: randomUUID() },
          randomUUID(),
        ),
      ).rejects.toThrow("SURAT_JALAN_EVIDENCE_REQUIRED");
      await expect(
        notes.receiveDeliveryNote(f.c, f.a, draft.id, f.handover("5"), randomUUID()),
      ).rejects.toThrow("DELIVERY_NOTE_RECEIPT_QTY_INVALID");
      await expect(
        notes.receiveDeliveryNote(f.c, f.a, draft.id, f.handover("3"), randomUUID()),
      ).rejects.toThrow("DELIVERY_NOTE_DISCREPANCY_REASON_REQUIRED");
      await expect(
        notes.receiveDeliveryNote(
          f.c,
          f.a,
          draft.id,
          { ...f.handover(), handover_at: "2000-01-01T00:00:00Z" },
          randomUUID(),
        ),
      ).rejects.toThrow("DELIVERY_NOTE_RECEIPT_DATE_INVALID");
      expect(await f.tx.deliveryNoteReceipt.count({ where: { companyId: f.c } })).toBe(0);
    }));
  it("issues the saved quantity without receipt evidence and posts only once", async () =>
    o2cFixture(async (f) => {
      const draft = await notes.createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
      const key = randomUUID();
      const issued = await notes.issueDeliveryNote(f.c, f.a, draft.id, {}, key);
      expect(issued.state).toBe("ISSUED");
      expect(issued.handoverAt).toBeNull();
      expect(issued.evidenceId).toBeNull();
      expect(issued.lines[0]!.deliveredQuantity!.toString()).toBe("4");
      expect(
        (
          await f.tx.stockLot.findUniqueOrThrow({ where: { id: f.lot.id } })
        ).quantityOnHand.toString(),
      ).toBe("6");
      expect((await notes.issueDeliveryNote(f.c, f.a, draft.id, {}, key)).id).toBe(draft.id);
      expect(await f.tx.financeJournal.count({ where: { companyId: f.c } })).toBe(1);
    }));
});
