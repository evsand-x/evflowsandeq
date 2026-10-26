import { Prisma } from "@evflow/database";
import * as related from "../../packages/backend/src/sales/order-related";
import { detailFixture } from "./order-detail-fixture";
import { orderDetail } from "../../packages/backend/src/sales/order-detail";
import { listSalesOrders } from "../../packages/backend/src/sales/order-list";

it("omits DP from the SO list without receipt or advance permission", async () =>
  detailFixture(async ({ tx, c }) => {
    const result = await listSalesOrders(c, 1, "", undefined, {}, tx, false);
    expect(result.rows[0]).not.toHaveProperty("downPayment");
  }));

it("each warehouse document requires its own submenu read and links to its own page", async () =>
  detailFixture(async ({ tx, c, a, order, batch }) => {
    await tx.pickList.create({ data: { companyId: c, fulfillmentBatchId: batch.id } });
    for (const kind of ["PACKING", "SURAT_JALAN"])
      await tx.fulfillmentDocument.create({
        data: { companyId: c, batchId: batch.id, kind, number: kind, issuedById: a, snapshot: {} },
      });
    const picking = await related.orderRelated(
      c,
      order.id,
      (p) => p === "outbound_picking.read",
      tx,
    );
    expect(picking.map((d) => d.kind)).toEqual(["PICK_SLIP"]);
    expect(picking[0]!.href).toBe(`/operations/pick-slips/${batch.id}`);
    expect(
      (await related.orderRelated(c, order.id, (p) => p === "outbound_checking.read", tx)).map(
        (d) => d.kind,
      ),
    ).toEqual(["PACKING_LIST"]);
    expect(
      (await related.orderRelated(c, order.id, (p) => p === "outbound_shipping.read", tx)).map(
        (d) => d.kind,
      ),
    ).toEqual(["SURAT_JALAN"]);
  }));

it("detail omits financial facts and private snapshots for warehouse-only user", async () =>
  detailFixture(async ({ tx, c, order }) => {
    const value = await orderDetail(c, order.id, (p) => p === "outbound_checking.read", tx);
    expect(value).not.toHaveProperty("advances");
    expect(value).not.toHaveProperty("remainingBill");
    expect(value).not.toHaveProperty("downPayment");
    expect(value).not.toHaveProperty("paymentSnapshot");
    expect(value.lines[0]).toMatchObject({
      ordered: "10",
      accepted: "0",
      remaining: "10",
      lineStatus: "READY",
    });
    expect(value.companyProfile.name).toBe("Detail integration fixture");
  }));

it("lists invoice issued from packing list before POD", async () =>
  detailFixture(async ({ tx, c, customer, order, batch }) => {
    const invoice = await tx.salesInvoice.create({
      data: {
        companyId: c,
        customerId: customer.id,
        salesOrderId: order.id,
        fulfillmentBatchId: batch.id,
        number: "INV.01",
        state: "ISSUED_WAITING_POD",
        subtotal: "1000",
        total: "1000",
      },
    });
    const docs = await related.orderRelated(c, order.id, () => true, tx);
    expect(docs.find((d) => d.id === invoice.id)).toMatchObject({
      kind: "INVOICE",
      status: "ISSUED_WAITING_POD",
      amount: "1000",
    });
  }));
it("omits invoices and advances for warehouse-only user", async () =>
  detailFixture(async ({ tx, c, customer, order, batch }) => {
    await tx.salesInvoice.create({
      data: {
        companyId: c,
        customerId: customer.id,
        salesOrderId: order.id,
        number: "INV.01",
        subtotal: "1000",
        total: "1000",
      },
    });
    await tx.pickList.create({ data: { companyId: c, fulfillmentBatchId: batch.id } });
    const docs = await related.orderRelated(c, order.id, (p) => p === "outbound_picking.read", tx);
    expect(docs.map((d) => d.kind)).toEqual(["PICK_SLIP"]);
  }));
it("computes proforma status without per-document transactions", async () =>
  detailFixture(async ({ tx, c, a, order, batch }) => {
    for (const kind of ["PROFORMA", "PROFORMA_REVISION:1"])
      await tx.fulfillmentDocument.create({
        data: {
          companyId: c,
          batchId: batch.id,
          kind,
          number: kind,
          issuedById: a,
          snapshot: { source_version: "stale" },
        },
      });
    const docs = await related.orderRelated(c, order.id, (p) => p === "proforma.read", tx);
    expect(docs.map((d) => d.status).sort()).toEqual(["REVISION_REQUIRED", "SUPERSEDED"]);
  }));
it("line values and status for partial, returned and closed lines", () => {
  const d = (v: string) => new Prisma.Decimal(v);
  const line = {
    orderedQuantity: d("10"),
    closedQuantity: d("2"),
    allocatedQuantity: d("10"),
    allocations: [
      { acceptedQuantity: d("5"), inTransitQuantity: d("0"), returnedQuantity: d("3") },
    ],
  };
  expect(related.orderLineProgress(line)).toMatchObject({
    ordered: "10",
    sent: "8",
    accepted: "5",
    closed: "2",
    remaining: "3",
    lineStatus: "IN_DELIVERY",
  });
  expect(related.orderLineProgress({ ...line, closedQuantity: d("10") })).toMatchObject({
    remaining: "0",
    lineStatus: "CLOSED",
  });
});
it("remaining bill does not double count advance allocated to invoice", () => {
  expect(
    related.remainingOrderBill("1000", ["100"], [{ total: "1000", outstandingAmount: "600" }]),
  ).toBe("500");
});
it("neighbors follow order date then number", async () =>
  detailFixture(async ({ tx, c, a, customer, order }) => {
    const prior = await tx.salesOrder.create({
      data: {
        companyId: c,
        customerId: customer.id,
        createdById: a,
        number: "SO.01",
        orderDate: order.orderDate,
      },
    });
    const next = await tx.salesOrder.create({
      data: {
        companyId: c,
        customerId: customer.id,
        createdById: a,
        number: "SO.00",
        orderDate: new Date("2026-10-21"),
      },
    });
    expect(await related.orderNeighbors(c, order, tx)).toEqual({
      previousId: prior.id,
      nextId: next.id,
    });
  }));
