import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@evflow/database";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import {
  financeFixture,
  cleanFinanceTransactions,
  cleanFinanceConfiguration,
} from "./finance-fixture";

const service = new OtcPtpService(new AuditService());
const companyId = randomUUID(),
  actor = randomUUID();
let customerId: string, productId: string, lotId: string, locatorId: string;
const master = {
  companyId,
  code: "TEST",
  name: "Financial correction test",
  normalizedName: "financial correction test",
  createdById: actor,
  updatedById: actor,
  state: "ACTIVE" as const,
};

beforeAll(async () => {
  await prisma.company.create({ data: { id: companyId, name: "O2C correction test" } });
  await financeFixture(companyId, actor);
  await prisma.user.create({
    data: {
      id: actor,
      email: `${actor}@example.test`,
      displayName: "Test",
      passwordHash: "DISABLED",
    },
  });
  await prisma.companyMembership.create({ data: { companyId, userId: actor } });
  const customer = await prisma.customer.create({ data: master });
  customerId = customer.id;
  const category = await prisma.productCategory.create({ data: master });
  const uom = await prisma.uom.create({ data: master });
  const product = await prisma.product.create({
    data: { ...master, categoryId: category.id, baseUomId: uom.id },
  });
  productId = product.id;
  const warehouse = await prisma.warehouse.create({
    data: { ...master, timezone: "Asia/Makassar" },
  });
  const locator = await prisma.locator.create({
    data: { ...master, warehouseId: warehouse.id, locatorType: "QUARANTINE" },
  });
  locatorId = locator.id;
  const lot = await prisma.stockLot.create({
    data: {
      companyId,
      productId,
      warehouseId: warehouse.id,
      locatorId,
      batchNo: "TEST",
      quantityOnHand: "10",
      unitCost: "5",
    },
  });
  lotId = lot.id;
});

afterAll(async () => {
  await cleanFinanceTransactions(companyId);
  await cleanFinanceConfiguration(companyId);
  await prisma.customerRefund.deleteMany({ where: { companyId } });
  await prisma.creditNote.deleteMany({ where: { companyId } });
  await prisma.customerReturnLine.deleteMany({ where: { customerReturn: { companyId } } });
  await prisma.customerReturn.deleteMany({ where: { companyId } });
  await prisma.ledgerEntry.deleteMany({ where: { companyId } });
  await prisma.salesInvoice.deleteMany({ where: { companyId } });
  await prisma.deliveryReceiptLine.deleteMany({ where: { deliveryReceipt: { companyId } } });
  await prisma.deliveryReceipt.deleteMany({ where: { companyId } });
  await prisma.fulfillmentAllocation.deleteMany({ where: { fulfillmentBatch: { companyId } } });
  await prisma.fulfillmentBatch.deleteMany({ where: { companyId } });
  await prisma.salesOrderLine.deleteMany({ where: { companyId } });
  await prisma.salesOrder.deleteMany({ where: { companyId } });
  await prisma.stockLot.deleteMany({ where: { companyId } });
  await prisma.locator.deleteMany({ where: { companyId } });
  await prisma.warehouse.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.uom.deleteMany({ where: { companyId } });
  await prisma.productCategory.deleteMany({ where: { companyId } });
  await prisma.customer.deleteMany({ where: { companyId } });
  await prisma.masterCodeSequence.deleteMany({ where: { companyId } });
  await prisma.auditEvent.deleteMany({ where: { companyId } });
  await prisma.companyMembership.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
  await prisma.user.delete({ where: { id: actor } });
  await prisma.$disconnect();
});

async function fixture(outstanding: string) {
  const order = await prisma.salesOrder.create({
    data: {
      companyId,
      customerId,
      number: randomUUID(),
      createdById: actor,
      lines: { create: { companyId, productId, orderedQuantity: "10", unitPrice: "10" } },
    },
    include: { lines: true },
  });
  const batch = await prisma.fulfillmentBatch.create({
    data: {
      companyId,
      salesOrderId: order.id,
      number: randomUUID(),
      allocations: {
        create: {
          salesOrderLineId: order.lines[0].id,
          stockLotId: lotId,
          quantity: "10",
          acceptedQuantity: "10",
        },
      },
    },
    include: { allocations: true },
  });
  const pod = await prisma.deliveryReceipt.create({
    data: {
      companyId,
      salesOrderId: order.id,
      fulfillmentBatchId: batch.id,
      acceptedAt: new Date(),
      acceptedQuantity: "10",
      lines: {
        create: { fulfillmentAllocationId: batch.allocations[0].id, acceptedQuantity: "10" },
      },
    },
    include: { lines: true },
  });
  const invoice = await prisma.salesInvoice.create({
    data: {
      companyId,
      customerId,
      salesOrderId: order.id,
      deliveryReceiptId: pod.id,
      number: randomUUID(),
      subtotal: "100",
      outstandingAmount: outstanding,
      dueDate: new Date(),
      state: "POSTED",
    },
  });
  const ret = await prisma.customerReturn.create({
    data: {
      companyId,
      customerId,
      salesInvoiceId: invoice.id,
      reason: "test",
      idempotencyKey: randomUUID(),
      createdById: actor,
      state: "RECEIVED",
      lines: {
        create: {
          deliveryReceiptLineId: pod.lines[0].id,
          quantity: "6",
          unitPrice: "10",
          quarantineLocatorId: locatorId,
          batchNo: "TEST",
        },
      },
    },
  });
  return { invoice, ret };
}

it.each([
  ["100", "40", "0"],
  ["25", "0", "35"],
  ["0", "0", "60"],
])(
  "splits a 60 credit note with AR %s into AR %s and credit %s",
  async (outstanding, expectedAr, expectedCredit) => {
    const { invoice, ret } = await fixture(outstanding);
    const [note, retry] = await Promise.all([
      service.postCreditNote(companyId, actor, ret.id),
      service.postCreditNote(companyId, actor, ret.id),
    ]);
    expect(note.id).toBe(retry.id);
    expect(
      (
        await prisma.salesInvoice.findUniqueOrThrow({ where: { id: invoice.id } })
      ).outstandingAmount.toString(),
    ).toBe(expectedAr);
    const entries = await prisma.ledgerEntry.findMany({ where: { sourceId: note.id } });
    expect(entries.find((e) => e.kind === "CUSTOMER_ADVANCE")!.credit.toString()).toBe(
      expectedCredit,
    );
    expect(
      entries.reduce((sum, e) => sum.add(e.debit).sub(e.credit), new Prisma.Decimal(0)).toString(),
    ).toBe("0");
    await expect(
      service.postCustomerRefund(
        companyId,
        actor,
        { credit_note_id: note.id, amount: new Prisma.Decimal(expectedCredit).add(1).toString() },
        randomUUID(),
      ),
    ).rejects.toThrow("REFUND_EXCEEDED");
  },
);

it("serializes refunds, replays once and rejects changed payload or foreign company", async () => {
  const { ret } = await fixture("0");
  const note = await service.postCreditNote(companyId, actor, ret.id);
  const key = randomUUID(),
    input = { credit_note_id: note.id, amount: "40" };
  const [one, retry] = await Promise.all([
    service.postCustomerRefund(companyId, actor, input, key),
    service.postCustomerRefund(companyId, actor, input, key),
  ]);
  expect(one.id).toBe(retry.id);
  await expect(
    service.postCustomerRefund(companyId, actor, { ...input, amount: "41" }, key),
  ).rejects.toThrow("IDEMPOTENCY_PAYLOAD_MISMATCH");
  const results = await Promise.allSettled([
    service.postCustomerRefund(companyId, actor, { ...input, amount: "15" }, randomUUID()),
    service.postCustomerRefund(companyId, actor, { ...input, amount: "15" }, randomUUID()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await expect(
    service.postCustomerRefund(randomUUID(), actor, input, randomUUID()),
  ).rejects.toThrow("Credit note tidak ditemukan");
  expect(
    await prisma.auditEvent.count({
      where: { companyId, resourceId: one.id, action: "customer_refund.posted" },
    }),
  ).toBe(1);
});
it("rejects returns from another customer or another invoice before stock changes", async () => {
  const first = await fixture("100"),
    second = await fixture("100");
  const line = await prisma.customerReturnLine.findFirstOrThrow({
    where: { customerReturnId: first.ret.id },
  });
  const input = {
    sales_invoice_id: second.invoice.id,
    reason: "test",
    lines: [
      {
        delivery_receipt_line_id: line.deliveryReceiptLineId,
        quantity: "1",
        quarantine_locator_id: locatorId,
        batch_no: "TEST",
      },
    ],
  };
  const before = await prisma.stockLot.findUniqueOrThrow({ where: { id: lotId } });
  await expect(
    service.createCustomerReturn(companyId, actor, customerId, input, randomUUID()),
  ).rejects.toThrow("RETURN_SOURCE_NOT_FOUND");
  await expect(
    service.createCustomerReturn(randomUUID(), actor, customerId, input, randomUUID()),
  ).rejects.toThrow("Pelanggan tidak ditemukan");
  expect(
    (await prisma.stockLot.findUniqueOrThrow({ where: { id: lotId } })).quantityOnHand.eq(
      before.quantityOnHand,
    ),
  ).toBe(true);
});
