import { randomUUID } from "node:crypto";
import {
  createDeliveryNote,
  issueDeliveryNote,
} from "../../packages/backend/src/sales/delivery-note";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { listSalesOrders } from "../../packages/backend/src/sales/order-list";
import { orderDetail } from "../../packages/backend/src/sales/order-detail";
import { orderActions } from "../../packages/backend/src/sales/order-actions";
import { resolveOrderNumber } from "../../packages/backend/src/sales/order-header";
import { previewDocumentNumber } from "../../packages/backend/src/common/document-number";
import { o2cFixture } from "./o2c-release1-fixture";

type ListRow = {
  id: string;
  displayStatus: string;
  shipping: { status: string; remainingQuantity: string; draftDeliveryNotes: number } | null;
  billing?: { status: string; invoiceCount: number } | null;
  paymentTerm: { code: string; label: string } | null;
};
const all = () => true;

describe("SO read model from Release 1 Surat Jalan and invoices", () => {
  it("counts issued Surat Jalan as delivered and tracks billing per order", async () =>
    o2cFixture(async (f) => {
      const list = async (filters = {}, billing = true) =>
        (await listSalesOrders(
          f.c,
          1,
          "",
          undefined,
          filters,
          f.tx,
          false,
          billing,
        )) as unknown as {
          rows: ListRow[];
          total: number;
          summary: Record<string, number>;
        };
      const before = await list();
      expect(before.rows[0]).toMatchObject({
        displayStatus: "OPEN",
        shipping: { status: "NOT_SHIPPED", remainingQuantity: "10", draftDeliveryNotes: 0 },
        billing: { status: "NONE", invoiceCount: 0 },
      });

      const note = await createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
      expect((await list()).rows[0]!.shipping).toMatchObject({
        status: "NOT_SHIPPED",
        draftDeliveryNotes: 1,
      });
      await issueDeliveryNote(f.c, f.a, note.id, f.handover("4"), randomUUID());

      const shipped = await list();
      expect(shipped.rows[0]).toMatchObject({
        displayStatus: "PARTIALLY_SHIPPED",
        shipping: { status: "PARTIAL", remainingQuantity: "6", draftDeliveryNotes: 0 },
        billing: { status: "UNINVOICED" },
      });
      expect(shipped.summary).toMatchObject({ toShip: 1, uninvoiced: 1 });
      expect((await list({ queue: "TO_SHIP" })).total).toBe(1);
      expect((await list({ queue: "UNINVOICED" })).total).toBe(1);
      expect((await list({ status: "PARTIALLY_SHIPPED" })).total).toBe(1);
      // Without invoice access the billing column and count are not returned.
      const restricted = await list({}, false);
      expect(restricted.rows[0]).not.toHaveProperty("billing");
      expect(restricted.summary).not.toHaveProperty("uninvoiced");

      const detail = await orderDetail(f.c, f.order.id, all, f.tx);
      expect(detail.lines[0]).toMatchObject({ delivered: "4", invoiced: "0", remaining: "6" });
      expect(detail.deliveryNotes).toMatchObject([{ id: note.id, state: "ISSUED" }]);
      expect(detail.billing).toMatchObject({ status: "UNINVOICED", uninvoicedDeliveryNotes: 1 });
      expect(detail.shipping).toMatchObject({ status: "PARTIAL", remainingQuantity: "6" });
      const limited = await orderDetail(f.c, f.order.id, () => false, f.tx);
      expect(limited).not.toHaveProperty("billing");
      expect(limited).not.toHaveProperty("deliveryNotes");
      expect(limited.lines[0]).not.toHaveProperty("invoiced");

      const invoice = await new OtcPtpService(new AuditService()).createInvoiceFromDeliveryNote(
        f.c,
        f.a,
        { surat_jalan_id: note.id },
        randomUUID(),
      );
      const billed = await list();
      expect(billed.rows[0]!.billing).toMatchObject({ status: "UNPAID", invoiceCount: 1 });
      expect((await list({ queue: "UNINVOICED" })).total).toBe(0);
      const billedDetail = await orderDetail(f.c, f.order.id, all, f.tx);
      expect(billedDetail.lines[0]).toMatchObject({ delivered: "4", invoiced: "4" });
      expect(billedDetail.invoiceSummaries).toMatchObject([
        { id: invoice.id, paymentStatus: "UNPAID" },
      ]);

      await f.tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { outstandingAmount: "0" },
      });
      expect((await list()).rows[0]!.billing).toMatchObject({ status: "PAID" });

      const rest = await createDeliveryNote(f.c, f.a, f.input("6"), randomUUID());
      await issueDeliveryNote(f.c, f.a, rest.id, f.handover("6"), randomUUID());
      const done = await list();
      expect(done.rows[0]).toMatchObject({
        displayStatus: "COMPLETED",
        shipping: { status: "SHIPPED", remainingQuantity: "0" },
        billing: { status: "UNINVOICED" },
      });
      expect((await list({ queue: "TO_SHIP" })).total).toBe(0);
    }));

  it("suggests the next SO number without consuming it and accepts a unique edited number", async () =>
    o2cFixture(async (f) => {
      await f.tx.documentNumberRule.create({
        data: {
          companyId: f.c,
          documentKind: "sales_order",
          prefix: "SO",
          digits: 4,
          effectiveFrom: new Date("2000-01-01"),
          effectiveTo: new Date("2999-01-01"),
          createdById: f.a,
        },
      });
      const suggested = await previewDocumentNumber(f.tx, f.c, "sales_order");
      expect(suggested).toMatch(/^SO\.\d{4}\.\d{2}\.0001$/);
      expect(await previewDocumentNumber(f.tx, f.c, "sales_order")).toBe(suggested);

      // Typing the suggestion consumes the sequence, so the next suggestion moves on.
      expect(await resolveOrderNumber(f.tx, f.c, suggested)).toBe(suggested);
      expect(await previewDocumentNumber(f.tx, f.c, "sales_order")).toMatch(/\.0002$/);

      // A custom number does not consume the sequence and must be unique.
      expect(await resolveOrderNumber(f.tx, f.c, "SO-CUSTOM-01")).toBe("SO-CUSTOM-01");
      expect(await previewDocumentNumber(f.tx, f.c, "sales_order")).toMatch(/\.0002$/);
      await expect(resolveOrderNumber(f.tx, f.c, f.order.number)).rejects.toMatchObject({
        response: { code: "ORDER_NUMBER_TAKEN" },
      });
      // Omitting the number keeps the existing automatic behaviour.
      expect(await resolveOrderNumber(f.tx, f.c, undefined)).toMatch(/\.0002$/);
    }));
});

describe("SO actions after Release 1 handover", () => {
  it("stops offering revise once a Surat Jalan is issued", async () =>
    o2cFixture(async (f) => {
      const codes = async () =>
        (await orderActions(f.c, f.a, f.order.id, all, f.tx)).actions
          .filter((a) => a.enabled)
          .map((a) => a.code);
      expect(await codes()).toContain("revise");
      const note = await createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
      expect(await codes()).toContain("revise");
      await issueDeliveryNote(f.c, f.a, note.id, f.handover("4"), randomUUID());
      expect(await codes()).not.toContain("revise");
    }));
});
