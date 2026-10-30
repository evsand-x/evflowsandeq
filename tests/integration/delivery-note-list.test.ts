import { randomUUID } from "node:crypto";
import {
  createDeliveryNote,
  issueDeliveryNote,
} from "../../packages/backend/src/sales/delivery-note";
import { deliveryNoteList } from "../../packages/backend/src/sales/delivery-note-list";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { o2cFixture } from "./o2c-release1-fixture";

describe("Surat Jalan list read model (Release 1)", () => {
  it("lists warehouse, handover, quantity and invoice with tab counts", async () =>
    o2cFixture(async (f) => {
      const list = (input = {}, billing = true) => deliveryNoteList(f.c, input, billing, f.tx);
      const first = await createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
      const second = await createDeliveryNote(f.c, f.a, f.input("3"), randomUUID());
      expect((await list()).summary).toEqual({ all: 2, draft: 2, uninvoiced: 0, invoiced: 0 });

      await issueDeliveryNote(f.c, f.a, first.id, {}, randomUUID());
      const issued = await list({ tab: "UNINVOICED" });
      expect(issued.total).toBe(1);
      expect(issued.rows[0]).toMatchObject({
        id: first.id,
        state: "ISSUED",
        quantity: "4",
        unit: f.uom.name,
        warehouses: [{ id: f.w.id, name: f.w.name }],
        invoice: null,
      });
      expect(issued.rows[0]!.handoverAt).toBeNull();
      expect((await list({ tab: "DRAFT" })).rows.map((r) => r.id)).toEqual([second.id]);

      const invoice = await new OtcPtpService(new AuditService()).createInvoiceFromDeliveryNote(
        f.c,
        f.a,
        { surat_jalan_id: first.id },
        randomUUID(),
      );
      const billed = await list({ tab: "INVOICED" });
      expect(billed.rows[0]).toMatchObject({
        id: first.id,
        invoice: { id: invoice.id, number: invoice.number },
      });
      expect((await list()).summary).toEqual({ all: 2, draft: 1, uninvoiced: 0, invoiced: 1 });

      // Filters: warehouse and search combine with the tab counts.
      expect((await list({ warehouseId: randomUUID() })).summary.all).toBe(0);
      expect((await list({ search: first.number })).total).toBe(1);
      expect(billed.warehouses.map((w) => w.id)).toContain(f.w.id);

      // Without invoice access the invoice column and invoice counts are not returned.
      const restricted = await list({}, false);
      expect(restricted.summary).toEqual({ all: 2, draft: 1 });
      expect(restricted.rows[0]).not.toHaveProperty("invoice");
    }));
});
