import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { orderReadFacts } from "../../packages/backend/src/sales/order-summary";
import { financeFixture } from "./finance-fixture";
import { configureNumbering } from "../../packages/backend/src/common/document-number";
import { OperationsService } from "../../packages/backend/src/sales/operations.service";
const svc = new OtcPtpService(new AuditService());
const c = randomUUID(),
  actor = randomUUID(),
  verifier = randomUUID();
let customerId: string, productId: string, bankId: string, evidenceId: string;
const master = () => ({
  companyId: c,
  code: randomUUID(),
  name: "Test",
  normalizedName: randomUUID(),
  state: "ACTIVE" as const,
  createdById: actor,
  updatedById: actor,
});
beforeAll(async () => {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  await prisma.company.create({ data: { id: c, name: "ADVANCE TEST ONLY" } });
  for (const id of [actor, verifier]) {
    await prisma.user.create({
      data: { id, email: `${id}@test.local`, displayName: "Test", passwordHash: "disabled" },
    });
    await prisma.companyMembership.create({ data: { companyId: c, userId: id } });
  }
  bankId = (await financeFixture(c, actor)).id;
  evidenceId = (
    await prisma.transactionEvidence.create({
      data: {
        companyId: c,
        actorId: actor,
        purpose: "PAYMENT",
        originalName: "fixture.png",
        objectKey: "TEST-ONLY",
        sha256: "TEST-ONLY",
        sizeBytes: 1,
      },
    })
  ).id;
  const uom = await prisma.uom.create({ data: master() });
  const cat = await prisma.productCategory.create({ data: master() });
  productId = (
    await prisma.product.create({ data: { ...master(), categoryId: cat.id, baseUomId: uom.id } })
  ).id;
  const ch = await prisma.customerChannel.create({ data: master() });
  customerId = (await prisma.customer.create({ data: { ...master(), channelId: ch.id } })).id;
});
async function order() {
  return prisma.salesOrder.create({
    data: {
      companyId: c,
      customerId,
      number: randomUUID(),
      createdById: actor,
      lines: {
        create: {
          companyId: c,
          productId,
          orderedQuantity: "10",
          unitPrice: "10",
          taxSnapshot: {
            rule_id: randomUUID(),
            rate: "0",
            dpp_factor: "1",
            decimal_places: 2,
            rounding: "HALF_UP",
          },
        },
      },
    },
  });
}
const input = (amount = "30") => ({
  amount,
  received_at: "2026-10-25T00:00:00.000Z",
  bank_account_id: bankId,
  evidence_id: evidenceId,
});
const record = async (id: string, amount = "30", key = randomUUID()) =>
  svc.recordSalesOrderAdvance(c, actor, id, input(amount), key);
test("records advance pending without ledger or down payment", async () => {
  const o = await order();
  const before = await prisma.ledgerEntry.count({ where: { companyId: c } });
  const a = await record(o.id);
  expect(a.state).toBe("PENDING_VERIFICATION");
  expect(await prisma.ledgerEntry.count({ where: { companyId: c } })).toBe(before);
  expect((await orderReadFacts(c, [o])).get(o.id)?.downPayment).toBe("0");
});
test("rejects advance above order total and concurrent overpayment", async () => {
  const o = await order();
  await expect(record(o.id, "101")).rejects.toThrow("ADVANCE_EXCEEDS_ORDER_TOTAL");
  const results = await Promise.allSettled([record(o.id, "60"), record(o.id, "60")]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});
test("verifies once, links receipt to SO and increases DP", async () => {
  const o = await order();
  const a = await record(o.id);
  const results = await Promise.allSettled([
    svc.verifySalesOrderAdvance(c, verifier, a.id, { version: 1 }),
    svc.verifySalesOrderAdvance(c, verifier, a.id, { version: 1 }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  expect(failed.reason.message).toBe("ADVANCE_STATE_OR_VERSION_CHANGED");
  const receipt = await prisma.customerReceipt.findFirstOrThrow({
    where: { companyId: c, salesOrderId: o.id },
  });
  expect(receipt.amount.toString()).toBe("30");
  expect(await prisma.ledgerEntry.count({ where: { companyId: c, sourceId: receipt.id } })).toBe(2);
  expect((await orderReadFacts(c, [o])).get(o.id)?.downPayment).toBe("30");
});
test("recorder cannot verify or reject own advance", async () => {
  const a = await record((await order()).id);
  await expect(svc.verifySalesOrderAdvance(c, actor, a.id, { version: 1 })).rejects.toThrow(
    "ADVANCE_SELF_VERIFICATION_FORBIDDEN",
  );
  await expect(
    svc.rejectSalesOrderAdvance(c, actor, a.id, { version: 1, reason: "Duplicate" }),
  ).rejects.toThrow("ADVANCE_SELF_VERIFICATION_FORBIDDEN");
});
test("reject stores reason and posts nothing", async () => {
  const o = await order();
  const a = await record(o.id);
  const result = await svc.rejectSalesOrderAdvance(c, verifier, a.id, {
    version: 1,
    reason: "Duplicate",
  });
  expect(result.state).toBe("REJECTED");
  expect(result.rejectionReason).toBe("Duplicate");
  expect(await prisma.customerReceipt.count({ where: { companyId: c, salesOrderId: o.id } })).toBe(
    0,
  );
  await expect(record(o.id, "100")).resolves.toMatchObject({ state: "PENDING_VERIFICATION" });
});
test("record is idempotent and isolates tenants", async () => {
  const o = await order();
  const key = randomUUID();
  const a = await record(o.id, "30", key);
  expect((await record(o.id, "30", key)).id).toBe(a.id);
  await expect(
    svc.verifySalesOrderAdvance(randomUUID(), verifier, a.id, { version: 1 }),
  ).rejects.toThrow();
});
test("closed period rolls verification back and preserves pending advance", async () => {
  const o = await order(),
    advance = await record(o.id);
  await prisma.financePeriod.updateMany({ where: { companyId: c }, data: { state: "CLOSED" } });
  try {
    await expect(
      svc.verifySalesOrderAdvance(c, verifier, advance.id, { version: 1 }),
    ).rejects.toThrow("FINANCE_PERIOD_NOT_OPEN");
    expect(await prisma.salesOrderAdvance.findUnique({ where: { id: advance.id } })).toMatchObject({
      state: "PENDING_VERIFICATION",
      version: 1,
      customerReceiptId: null,
    });
    expect(
      await prisma.customerReceipt.count({ where: { companyId: c, salesOrderId: o.id } }),
    ).toBe(0);
  } finally {
    await prisma.financePeriod.updateMany({ where: { companyId: c }, data: { state: "OPEN" } });
  }
});
test("SO-bound receipt cannot allocate to a different SO for the same customer", async () => {
  const source = await order(),
    other = await order(),
    advance = await record(source.id);
  const verified = await svc.verifySalesOrderAdvance(c, verifier, advance.id, { version: 1 });
  const invoice = await prisma.salesInvoice.create({
    data: {
      companyId: c,
      customerId,
      salesOrderId: other.id,
      number: randomUUID(),
      subtotal: "100",
      total: "100",
    },
  });
  await expect(
    svc.allocateCustomerReceipt(
      c,
      verifier,
      verified.customerReceiptId!,
      { invoice_id: invoice.id, amount: "10" },
      randomUUID(),
    ),
  ).rejects.toThrow("RECEIPT_FUNDS_BOUND_TO_ANOTHER_ORDER");
  expect(
    await prisma.customerReceiptAllocation.count({
      where: { receiptId: verified.customerReceiptId! },
    }),
  ).toBe(0);
});
test("foreign company cannot record, verify or reject an advance", async () => {
  const o = await order(),
    advance = await record(o.id),
    foreign = randomUUID();
  await expect(
    svc.recordSalesOrderAdvance(foreign, actor, o.id, input(), randomUUID()),
  ).rejects.toThrow();
  await expect(
    svc.verifySalesOrderAdvance(foreign, verifier, advance.id, { version: 1 }),
  ).rejects.toThrow();
  await expect(
    svc.rejectSalesOrderAdvance(foreign, verifier, advance.id, { version: 1, reason: "Foreign" }),
  ).rejects.toThrow();
  expect(await prisma.salesOrderAdvance.findUnique({ where: { id: advance.id } })).toMatchObject({
    state: "PENDING_VERIFICATION",
    version: 1,
  });
});
test("real PREPAY dispatch waits for verification and cannot reuse SO funds across batches", async () => {
  const o = await order();
  await prisma.salesOrder.update({
    where: { id: o.id },
    data: { state: "OPEN", paymentSnapshot: { mode: "PREPAY" } },
  });
  const line = await prisma.salesOrderLine.findFirstOrThrow({ where: { salesOrderId: o.id } });
  await prisma.salesOrderLine.update({
    where: { id: line.id },
    data: { priceSnapshot: { unit_price: "10" } },
  });
  const warehouse = await prisma.warehouse.create({
    data: { ...master(), timezone: "Asia/Makassar" },
  });
  const locator = await prisma.locator.create({
    data: { ...master(), warehouseId: warehouse.id, locatorType: "STORAGE" },
  });
  await configureNumbering(
    c,
    actor,
    {
      document_kind: "document_SURAT_JALAN",
      prefix: "TEST-SJ",
      digits: 6,
      effective_from: "2000-01-01",
      effective_to: "2099-12-31",
    },
    randomUUID(),
  );
  const batches = [];
  for (let n = 0; n < 2; n++) {
    const stock = await prisma.stockLot.create({
      data: {
        companyId: c,
        productId,
        warehouseId: warehouse.id,
        locatorId: locator.id,
        batchNo: randomUUID(),
        expiryDate: new Date("2090-01-01"),
        quantityOnHand: "5",
        quantityReserved: "5",
        unitCost: "2",
        qualityState: "AVAILABLE",
      },
    });
    const batch = await prisma.fulfillmentBatch.create({
      data: {
        companyId: c,
        salesOrderId: o.id,
        number: randomUUID(),
        shipmentSnapshot: { driver: "Test" },
        reservationSnapshot: { test: true },
      },
    });
    const allocation = await prisma.fulfillmentAllocation.create({
      data: {
        fulfillmentBatchId: batch.id,
        salesOrderLineId: line.id,
        stockLotId: stock.id,
        quantity: "5",
      },
    });
    await prisma.pickList.create({
      data: {
        companyId: c,
        fulfillmentBatchId: batch.id,
        state: "CHECKED",
        lines: {
          create: {
            fulfillmentAllocationId: allocation.id,
            assignedQuantity: "5",
            pickedQuantity: "5",
            checkedQuantity: "5",
          },
        },
      },
    });
    await prisma.fulfillmentDocument.create({
      data: {
        companyId: c,
        batchId: batch.id,
        kind: "PACKING",
        number: randomUUID(),
        issuedById: actor,
        snapshot: { test: true },
      },
    });
    batches.push(batch);
  }
  const advance = await record(o.id, "50");
  const proforma = await prisma.fulfillmentDocument.create({
    data: {
      companyId: c,
      batchId: batches[0]!.id,
      kind: "PROFORMA",
      number: randomUUID(),
      issuedById: actor,
      snapshot: { currency: "IDR" },
    },
  });
  const operations = new OperationsService(new AuditService());
  expect((await operations.proforma(c, proforma.id, true)).verifiedFunds).toBe("0");
  await expect(svc.dispatch(c, actor, batches[0]!.id, randomUUID())).rejects.toThrow(
    "PREPAYMENT_REQUIRED",
  );
  expect(
    (await prisma.fulfillmentBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } })).state,
  ).toBe("ALLOCATED");
  const verified = await svc.verifySalesOrderAdvance(c, verifier, advance.id, { version: 1 });
  expect((await operations.proforma(c, proforma.id, true)).verifiedFunds).toBe("50");
  expect((await operations.proforma(c, proforma.id, false)).verifiedFunds).toBeNull();
  const results = await Promise.allSettled(
    batches.map((b) => svc.dispatch(c, actor, b.id, randomUUID())),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.message,
  ).toBe("PREPAYMENT_REQUIRED");
  const winner = (
    results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
      id: string;
      state: string;
    }>
  ).value;
  expect(winner.state).toBe("DISPATCHED");
  expect(
    (await prisma.customerReceipt.findUniqueOrThrow({ where: { id: verified.customerReceiptId! } }))
      .fulfillmentBatchId,
  ).toBe(winner.id);
  expect(
    await prisma.ledgerEntry.count({
      where: { companyId: c, sourceId: winner.id, sourceType: "FULFILLMENT" },
    }),
  ).toBe(2);
});
// Real concurrent transactions commit immutable ledger records. Keep this uniquely named, local-only fixture; cleanup must drop its disposable database, never weaken production triggers.
