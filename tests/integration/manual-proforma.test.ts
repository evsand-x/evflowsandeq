import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import type { Prisma } from "@evflow/database";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { setCustomerCredit } from "../../packages/backend/src/sales/customer-credit";
import { ensureTestTermList } from "../../tools/qa/payment-terms-fixture";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import {
  previewProforma,
  issueProforma,
  proformaStatus,
} from "../../packages/backend/src/sales/proforma";
import { OperationsService } from "../../packages/backend/src/sales/operations.service";

const c = randomUUID(),
  actor = randomUUID();
const service = new OtcPtpService(new AuditService());
const read = new OperationsService(new AuditService());
let customerId: string, productId: string, stockId: string, evidenceId: string;
const master = () => ({
  companyId: c,
  code: randomUUID(),
  name: randomUUID(),
  normalizedName: randomUUID(),
  state: "ACTIVE" as const,
  createdById: actor,
  updatedById: actor,
});
const tax = {
  rule_id: randomUUID(),
  name: "TEST VAT",
  rate: "0.11",
  dpp_factor: "1",
  decimal_places: 2,
  rounding: "HALF_UP",
};

beforeAll(async () => {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Manual proforma integration tests require a local development database.");
  await prisma.company.create({ data: { id: c, name: "MANUAL PROFORMA TEST ONLY" } });
  await prisma.user.create({
    data: {
      id: actor,
      email: `${actor}@test.local`,
      displayName: "Proforma test",
      passwordHash: "DISABLED",
    },
  });
  await prisma.companyMembership.create({ data: { companyId: c, userId: actor } });
  const uom = await prisma.uom.create({ data: master() });
  const category = await prisma.productCategory.create({ data: master() });
  const product = await prisma.product.create({
    data: { ...master(), categoryId: category.id, baseUomId: uom.id },
  });
  productId = product.id;
  customerId = (await prisma.customer.create({ data: master() })).id;
  const warehouse = await prisma.warehouse.create({
    data: { ...master(), timezone: "Asia/Makassar" },
  });
  const locator = await prisma.locator.create({
    data: { ...master(), warehouseId: warehouse.id, locatorType: "STORAGE" },
  });
  stockId = (
    await prisma.stockLot.create({
      data: {
        companyId: c,
        warehouseId: warehouse.id,
        locatorId: locator.id,
        productId,
        batchNo: "TEST",
        expiryDate: new Date("2099-01-01"),
        quantityOnHand: "100",
        unitCost: "2",
        qualityState: "AVAILABLE",
      },
    })
  ).id;
  evidenceId = (
    await prisma.transactionEvidence.create({
      data: {
        companyId: c,
        actorId: actor,
        purpose: "SALES_ORDER",
        originalName: "test",
        objectKey: "test",
        sha256: "test",
        sizeBytes: 1,
      },
    })
  ).id;
  for (const [documentKind, prefix] of [
    ["sales_order", "SO-"],
    ["fulfillment", "FUL-"],
    ["document_PICKING", "PICK-"],
    ["document_PROFORMA", "PRO-"],
  ]) {
    await prisma.documentNumberRule.create({
      data: {
        companyId: c,
        documentKind: documentKind!,
        prefix: prefix!,
        digits: 5,
        resetPeriod: "YEARLY",
        effectiveFrom: new Date("2020-01-01"),
        effectiveTo: new Date("2099-01-01"),
        createdById: actor,
      },
    });
  }
  await prisma.systemPolicy.create({
    data: {
      companyId: c,
      code: "OPS-WH-02",
      name: "Test",
      ownerDomain: "warehouse",
      policyGroup: "warehouse",
      scope: "company",
      valueType: "object",
      validationSchema: {},
      defaultValueSnapshot: {},
      versions: {
        create: {
          versionNo: 1,
          state: "ACTIVE",
          savedById: actor,
          valueSnapshot: { with_expiry: "FEFO", without_expiry: "FIFO" },
        },
      },
    },
  });
  await prisma.productReferencePrice.create({
    data: {
      companyId: c,
      productId,
      uomId: uom.id,
      kind: "SALE",
      currency: "IDR",
      unitPrice: "10",
      effectiveFrom: new Date("2020-01-01"),
      createdById: actor,
    },
  });
  // Lines and taxable freight use the company default sales tax (synthetic 11%, DPP factor 1).
  const taxAccount = await prisma.financeAccount.create({
    data: { companyId: c, code: "TEST-PPN", name: "Synthetic PPN", category: "LIABILITY" },
  });
  const tax = await prisma.operationalTax.create({
    data: {
      companyId: c,
      name: "TEST",
      kind: "PPN",
      usage: "SALES",
      effect: "ADD",
      accountId: taxAccount.id,
      percentage: "11",
      dppFactor: "1",
      decimalPlaces: 2,
      rounding: "HALF_UP",
      effectiveFrom: new Date("2020-01-01"),
      isDefaultSales: true,
    },
  });
  await prisma.operationalTaxRevision.create({
    data: {
      companyId: c,
      taxId: tax.id,
      version: tax.version,
      snapshot: JSON.parse(JSON.stringify(tax)),
      actorId: actor,
    },
  });
  await ensureTestTermList(prisma, c, actor);
  await prisma.$transaction((tx) =>
    setCustomerCredit(tx, new AuditService(), c, actor, customerId, {
      default_term_code: "NET30",
      credit_limit: "100000",
      past_due_grace_days: 0,
    }),
  );
});

async function batch(quantity = "6") {
  const order = await prisma.salesOrder.create({
    data: {
      companyId: c,
      customerId,
      createdById: actor,
      number: randomUUID(),
      state: "OPEN",
      currency: "IDR",
      customerReference: "TEST-SP",
      deliveryAddress: "Test address",
      paymentSnapshot: { mode: "TEMPO", top_days: 30 },
      lines: {
        create: {
          companyId: c,
          productId,
          orderedQuantity: "10",
          allocatedQuantity: quantity,
          unitPrice: "10",
          taxSnapshot: tax,
          priceSnapshot: { unit_price: "10" },
        },
      },
    },
    include: { lines: true },
  });
  return prisma.fulfillmentBatch.create({
    data: {
      companyId: c,
      salesOrderId: order.id,
      number: randomUUID(),
      allocations: {
        create: { salesOrderLineId: order.lines[0]!.id, stockLotId: stockId, quantity },
      },
    },
    include: { allocations: true },
  });
}

it("submit allocates stock and picking without creating a proforma or requiring its numbering rule", async () => {
  await prisma.documentNumberRule.deleteMany({
    where: { companyId: c, documentKind: "document_PROFORMA" },
  });
  const order = await service.createSalesOrder(
    c,
    actor,
    {
      customer_id: customerId,
      customer_reference: "TEST",
      delivery_address: "Test",
      evidence_id: evidenceId,
      currency: "IDR",
      lines: [{ product_id: productId, quantity: "2", unit_price: "10" }],
    },
    randomUUID(),
  );
  await service.submitSalesOrder(c, actor, order.id, randomUUID(), order.version);
  expect(
    await prisma.fulfillmentBatch.count({ where: { companyId: c, salesOrderId: order.id } }),
  ).toBe(1);
  expect(
    await prisma.fulfillmentDocument.count({
      where: { companyId: c, kind: { startsWith: "PROFORMA" } },
    }),
  ).toBe(0);
  expect(await prisma.fulfillmentDocument.count({ where: { companyId: c, kind: "PICKING" } })).toBe(
    1,
  );
  await prisma.documentNumberRule.create({
    data: {
      companyId: c,
      documentKind: "document_PROFORMA",
      prefix: "PRO-",
      digits: 5,
      resetPeriod: "YEARLY",
      effectiveFrom: new Date("2020-01-01"),
      effectiveTo: new Date("2099-01-01"),
      createdById: actor,
    },
  });
});

it("previews only allocated quantities without allocating a number; explicit concurrent commands issue once without financial posting", async () => {
  const b = await batch();
  const before = await prisma.masterCodeSequence.findMany({
    where: { companyId: c, entityType: { startsWith: "document_PROFORMA" } },
  });
  const preview = await previewProforma(c, b.id);
  expect(preview.snapshot.total).toBe("66.6");
  expect(preview.snapshot.allocations[0]!.quantity).toBe("6");
  expect(
    await prisma.masterCodeSequence.findMany({
      where: { companyId: c, entityType: { startsWith: "document_PROFORMA" } },
    }),
  ).toEqual(before);
  const key = randomUUID();
  const [one, two] = await Promise.all([
    issueProforma(c, actor, b.id, { version: preview.version }, key),
    issueProforma(c, actor, b.id, { version: preview.version }, randomUUID()),
  ]);
  expect(one.id).toBe(two.id);
  expect((await issueProforma(c, actor, b.id, { version: preview.version }, key)).id).toBe(one.id);
  await expect(issueProforma(c, actor, b.id, { version: "0".repeat(64) }, key)).rejects.toThrow(
    "IDEMPOTENCY_PAYLOAD_MISMATCH",
  );
  expect(
    await prisma.auditEvent.count({
      where: { companyId: c, action: "proforma.issued", resourceId: one.id },
    }),
  ).toBe(1);
  expect(await prisma.ledgerEntry.count({ where: { companyId: c } })).toBe(0);
  expect(await prisma.financeJournal.count({ where: { companyId: c } })).toBe(0);
  expect(await prisma.salesInvoice.count({ where: { companyId: c } })).toBe(0);
});

it("rejects stale preview and exposes explicit revisions while preserving the original", async () => {
  const b = await batch();
  const preview = await previewProforma(c, b.id);
  const one = await issueProforma(c, actor, b.id, { version: preview.version }, randomUUID());
  await prisma.fulfillmentAllocation.update({
    where: { id: b.allocations[0]!.id },
    data: { quantity: "5" },
  });
  await expect(
    issueProforma(c, actor, b.id, { version: preview.version }, randomUUID()),
  ).rejects.toThrow("Muat ulang");
  expect(await proformaStatus(c, one)).toBe("REVISION_REQUIRED");
  const next = await previewProforma(c, b.id);
  const two = await issueProforma(c, actor, b.id, { version: next.version }, randomUUID());
  expect(two.id).not.toBe(one.id);
  expect((two.snapshot as Prisma.JsonObject).supersedes_id).toBe(one.id);
  expect((await read.proforma(c, one.id)).status).toBe("SUPERSEDED");
  expect((await read.proforma(c, two.id)).status).toBe("ISSUED");
  const list = await read.list(c, "proformas", 1, "");
  expect(list.rows.some((row) => row.id === two.id)).toBe(true);
  expect(
    (await prisma.fulfillmentDocument.findUniqueOrThrow({ where: { id: one.id } })).snapshot,
  ).toEqual(one.snapshot);
});

it("permits unpaid PREPAY proforma while reservation is valid and reuses matching legacy originals", async () => {
  const b = await batch();
  await prisma.salesOrder.update({
    where: { id: b.salesOrderId },
    data: { paymentSnapshot: { mode: "PREPAY" } },
  });
  await prisma.fulfillmentBatch.update({
    where: { id: b.id },
    data: { reservationExpiresAt: new Date("2090-01-01") },
  });
  const p = await previewProforma(c, b.id);
  expect(
    await prisma.customerReceipt.count({ where: { companyId: c, fulfillmentBatchId: b.id } }),
  ).toBe(0);
  const original = await issueProforma(c, actor, b.id, { version: p.version }, randomUUID());
  const legacyBatch = await batch();
  const legacyPreview = await previewProforma(c, legacyBatch.id);
  const legacy = await prisma.fulfillmentDocument.create({
    data: {
      companyId: c,
      batchId: legacyBatch.id,
      kind: "PROFORMA",
      issuedById: actor,
      number: randomUUID(),
      snapshot: JSON.parse(JSON.stringify(legacyPreview.snapshot)),
    },
  });
  expect(
    (
      await issueProforma(
        c,
        actor,
        legacyBatch.id,
        { version: legacyPreview.version },
        randomUUID(),
      )
    ).id,
  ).toBe(legacy.id);
  await prisma.fulfillmentBatch.update({ where: { id: b.id }, data: { state: "CANCELLED" } });
  expect(await proformaStatus(c, original)).toBe("VOID");
});

it("previews freight replacement and VAT without persisting, then issues the same totals", async () => {
  const b = await batch();
  const before = await prisma.fulfillmentBatch.findUniqueOrThrow({ where: { id: b.id } });
  const base = await previewProforma(c, b.id);
  const freight = { amount: "100", tax_mode: "TAXABLE" };
  const taxable = await previewProforma(c, b.id, { freight });
  expect(taxable.version).toBe(base.version);
  expect(taxable.snapshot.freight.tax).toBe("11");
  expect(taxable.snapshot.tax).toBe("17.6");
  expect(taxable.snapshot.total).toBe("177.6");
  const nonTaxable = await previewProforma(c, b.id, {
    freight: { ...freight, tax_mode: "NON_TAXABLE" },
  });
  expect(nonTaxable.snapshot.tax).toBe("6.6");
  expect(nonTaxable.snapshot.total).toBe("166.6");
  const disabled = await previewProforma(c, b.id, {
    freight: { amount: "0", tax_mode: "NON_TAXABLE" },
  });
  expect(disabled.snapshot.total).toBe("66.6");
  expect(await prisma.fulfillmentBatch.findUniqueOrThrow({ where: { id: b.id } })).toEqual(before);
  expect(await prisma.fulfillmentDocument.count({ where: { batchId: b.id } })).toBe(0);
  await expect(previewProforma(randomUUID(), b.id, { freight })).rejects.toThrow("tidak ditemukan");
  await expect(
    Promise.resolve().then(() =>
      previewProforma(c, b.id, { freight: { ...freight, amount: "-1" } }),
    ),
  ).rejects.toThrow();
  // Taxable freight always uses the default sales tax; a legacy freight tax rule id is refused.
  await expect(
    Promise.resolve().then(() =>
      previewProforma(c, b.id, { freight: { ...freight, tax_rule_id: randomUUID() } }),
    ),
  ).rejects.toThrow("FREIGHT_TAX_RULE_NOT_ALLOWED");
  const issued = await issueProforma(
    c,
    actor,
    b.id,
    { version: taxable.version, freight },
    randomUUID(),
  );
  expect(issued.snapshot).toMatchObject({
    total: "177.6",
    tax: "17.6",
    freight: { amount: "100", tax: "11" },
  });
  const replacement = await previewProforma(c, b.id, {
    freight: { amount: "50", tax_mode: "NON_TAXABLE" },
  });
  expect(replacement.snapshot.total).toBe("116.6");
  expect(replacement.snapshot.tax).toBe("6.6");
  expect(replacement.snapshot.freight.tax).toBe("0");
});

it("rejects foreign company, empty allocation, cancelled batch, held stock, expired reservation, and missing numbering", async () => {
  const b = await batch();
  await expect(previewProforma(randomUUID(), b.id)).rejects.toThrow("tidak ditemukan");
  await expect(previewProforma(c, (await batch("0")).id)).rejects.toThrow("positif");
  const p = await previewProforma(c, b.id);
  await prisma.fulfillmentBatch.update({ where: { id: b.id }, data: { state: "CANCELLED" } });
  await expect(issueProforma(c, actor, b.id, { version: p.version }, randomUUID())).rejects.toThrow(
    "masih dialokasikan",
  );
  await prisma.fulfillmentBatch.update({
    where: { id: b.id },
    data: { state: "ALLOCATED", reservationExpiresAt: new Date("2000-01-01") },
  });
  await expect(previewProforma(c, b.id)).rejects.toThrow("kedaluwarsa");
  await prisma.fulfillmentBatch.update({
    where: { id: b.id },
    data: { reservationExpiresAt: null },
  });
  await prisma.stockLot.update({ where: { id: stockId }, data: { qualityState: "HOLD" } });
  await expect(previewProforma(c, b.id)).rejects.toThrow("STOCK_NOT_ELIGIBLE");
  await prisma.stockLot.update({ where: { id: stockId }, data: { qualityState: "AVAILABLE" } });
  await prisma.documentNumberRule.deleteMany({
    where: { companyId: c, documentKind: "document_PROFORMA" },
  });
  await expect(issueProforma(c, actor, b.id, { version: p.version }, randomUUID())).rejects.toThrow(
    "NUMBERING_RULE_REQUIRED",
  );
  expect(await prisma.fulfillmentDocument.count({ where: { companyId: c, batchId: b.id } })).toBe(
    0,
  );
});

afterAll(async () => {
  // Revision control events are append-only; preserve their isolated test company and sources.
  if (await prisma.o2cControlEvent.count({ where: { companyId: c } })) return;
  // Isolated fixture only; no posted financial records are created by these tests.
  await prisma.transactionCommand.deleteMany({ where: { companyId: c } });
  await prisma.auditEvent.deleteMany({ where: { companyId: c } });
  await prisma.fulfillmentDocument.deleteMany({ where: { companyId: c } });
  await prisma.pickListLine.deleteMany({ where: { pickList: { companyId: c } } });
  await prisma.pickList.deleteMany({ where: { companyId: c } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId: c } });
  await prisma.fulfillmentAllocation.deleteMany({ where: { fulfillmentBatch: { companyId: c } } });
  await prisma.fulfillmentBatch.deleteMany({ where: { companyId: c } });
  await prisma.salesOrderLine.deleteMany({ where: { companyId: c } });
  await prisma.salesOrder.deleteMany({ where: { companyId: c } });
  await prisma.stockLot.deleteMany({ where: { companyId: c } });
  await prisma.transactionEvidence.deleteMany({ where: { companyId: c } });
  await prisma.operationalTaxRevision.deleteMany({ where: { companyId: c } });
  await prisma.operationalTax.deleteMany({ where: { companyId: c } });
  await prisma.financeAccount.deleteMany({ where: { companyId: c } });
  await prisma.productReferencePrice.deleteMany({ where: { companyId: c } });
  await prisma.policyVersion.deleteMany({ where: { policy: { companyId: c } } });
  await prisma.systemPolicy.deleteMany({ where: { companyId: c } });
  await prisma.documentNumberRule.deleteMany({ where: { companyId: c } });
  await prisma.masterCodeSequence.deleteMany({ where: { companyId: c } });
  await prisma.locator.deleteMany({ where: { companyId: c } });
  await prisma.warehouse.deleteMany({ where: { companyId: c } });
  await prisma.product.deleteMany({ where: { companyId: c } });
  await prisma.productCategory.deleteMany({ where: { companyId: c } });
  await prisma.uom.deleteMany({ where: { companyId: c } });
  await prisma.customer.deleteMany({ where: { companyId: c } });
  await prisma.companyMembership.deleteMany({ where: { companyId: c } });
  await prisma.user.deleteMany({ where: { id: actor } });
  await prisma.company.deleteMany({ where: { id: c } });
});
