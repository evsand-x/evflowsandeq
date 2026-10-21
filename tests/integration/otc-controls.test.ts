import { previewProforma, issueProforma } from "../../packages/backend/src/sales/proforma";
import { saveHandoff, listHandoffs } from "../../packages/backend/src/sales/commercial-handoff";
import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { processExceptionEvaluations } from "../../packages/backend/src/sales/exception-evaluation";
import { creditExposure } from "../../packages/backend/src/sales/transaction-controls";
import { OperationsService } from "../../packages/backend/src/sales/operations.service";
import {
  requestException,
  decideException,
} from "../../packages/backend/src/sales/exception-controls";
import {
  financeFixture,
  cleanFinanceTransactions,
  cleanFinanceConfiguration,
} from "./finance-fixture";
import {
  financeConfigure,
  createTaxComponent,
  taxComponentCommand,
  reconcileGl,
  importStatement,
  matchStatement,
  reviewStatement,
  createOfficialTaxDocument,
  verifyOfficialTaxDocument,
} from "../../packages/backend/src/finance/controls.service";

const service = new OtcPtpService(new AuditService());
const operations = new OperationsService(new AuditService());
const c = randomUUID(),
  actor = randomUUID(),
  approver = randomUUID(),
  outsider = randomUUID();
let productId: string,
  customerId: string,
  locatorId: string,
  warehouseId: string,
  uomId: string,
  bankAccountId: string;
const evidence: Record<string, string> = {};
async function exceptionPolicy(kind: "SALES_ORDER_UNLOCK" | "SPECIAL_PRICE") {
  return operations.approvalPolicy(
    c,
    actor,
    {
      document_kind: kind,
      currency: "IDR",
      maximum_amount: "1000",
      allowed_reasons: ["CREDIT_HOLD"],
      grant_hours: 24,
      steps: [{ mode: "ALL", user_ids: [approver, outsider] }],
      effective_from: "2020-01-01T00:00:00.000Z",
      effective_to: "2099-01-01T00:00:00.000Z",
    },
    randomUUID(),
  );
}
const master = () => ({
  companyId: c,
  code: randomUUID(),
  name: randomUUID(),
  normalizedName: randomUUID(),
  state: "ACTIVE" as const,
  createdById: actor,
  updatedById: actor,
});
beforeAll(async () => {
  await prisma.company.create({ data: { id: c, name: "OTC CONTROL TEST ONLY" } });
  for (const id of [actor, approver, outsider]) {
    await prisma.user.create({
      data: { id, email: `${id}@test.local`, displayName: "Test", passwordHash: "disabled" },
    });
    await prisma.companyMembership.create({ data: { companyId: c, userId: id } });
  }
  bankAccountId = (await financeFixture(c, actor)).id;
  for (const purpose of ["SALES_ORDER", "POD", "PAYMENT", "TAX"])
    evidence[purpose] = (
      await prisma.transactionEvidence.create({
        data: {
          companyId: c,
          actorId: actor,
          purpose,
          originalName: "fixture.png",
          objectKey: "TEST-ONLY",
          sha256: "TEST-ONLY",
          sizeBytes: 1,
        },
      })
    ).id;
  const uom = await prisma.uom.create({ data: master() });
  uomId = uom.id;
  const category = await prisma.productCategory.create({ data: master() });
  const p = await prisma.product.create({
    data: { ...master(), categoryId: category.id, baseUomId: uomId },
  });
  productId = p.id;
  const channel = await prisma.customerChannel.create({ data: master() });
  const customer = await prisma.customer.create({ data: { ...master(), channelId: channel.id } });
  customerId = customer.id;
  const warehouse = await prisma.warehouse.create({
    data: { ...master(), timezone: "Asia/Makassar" },
  });
  warehouseId = warehouse.id;
  const locator = await prisma.locator.create({
    data: { ...master(), warehouseId, locatorType: "STORAGE" },
  });
  locatorId = locator.id;
  await prisma.systemPolicy.create({
    data: {
      companyId: c,
      code: "OPS-WH-02",
      name: "Test strategy",
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
      uomId,
      kind: "SALE",
      currency: "IDR",
      unitPrice: "10",
      effectiveFrom: new Date("2020-01-01"),
      createdById: actor,
    },
  });
  await prisma.salesTaxRule.create({
    data: {
      companyId: c,
      customerId,
      productId,
      name: "Synthetic test only",
      legalReference: "TEST-NOT-A-TAX-SETTING",
      rate: "0.1",
      dppFactor: "1",
      decimalPlaces: 2,
      rounding: "HALF_UP",
      effectiveFrom: new Date("2020-01-01"),
      effectiveTo: new Date("2099-01-01"),
      createdById: actor,
    },
  });
});

async function policy(limit = "100000") {
  // Each test isolates this customer's transactions below; later timestamp wins.
  await prisma.customerPaymentPolicy.updateMany({
    where: { companyId: c },
    data: { active: false },
  });
  return service.setPaymentPolicy(c, actor, customerId, {
    mode: "TEMPO",
    top_days: 30,
    credit_limit: limit,
    past_due_grace_days: 0,
  });
}
async function lot(qty: string, expiry = "2090-01-01", qualityState = "AVAILABLE") {
  return prisma.stockLot.create({
    data: {
      companyId: c,
      productId,
      warehouseId,
      locatorId,
      batchNo: randomUUID(),
      expiryDate: new Date(expiry),
      quantityOnHand: qty,
      unitCost: "3",
      qualityState,
    },
  });
}
async function order(qtys = ["8"], price = "10") {
  return service.createSalesOrder(c, actor, {
    customer_id: customerId,
    customer_reference: "TEST-SP",
    delivery_address: "Test address",
    evidence_id: evidence.SALES_ORDER,
    currency: "IDR",
    lines: qtys.map((quantity) => ({ product_id: productId, quantity, unit_price: price })),
  });
}
async function cleanTransactions() {
  await cleanFinanceTransactions(c);
  await prisma.salesExceptionRequest.deleteMany({ where: { companyId: c } });
  await prisma.fulfillmentDocument.deleteMany({ where: { companyId: c } });
  await prisma.transactionCommand.deleteMany({ where: { companyId: c } });
  await prisma.transactionApprovalAction.deleteMany({ where: { companyId: c } });
  await prisma.transactionApprovalPolicy.deleteMany({ where: { companyId: c } });
  await prisma.customerReceiptAllocation.deleteMany({ where: { companyId: c } });
  await prisma.customerReceipt.deleteMany({ where: { companyId: c } });
  await prisma.ledgerEntry.deleteMany({ where: { companyId: c } });
  await prisma.salesInvoice.deleteMany({ where: { companyId: c } });
  await prisma.deliveryReceiptLine.deleteMany({ where: { deliveryReceipt: { companyId: c } } });
  await prisma.deliveryReceipt.deleteMany({ where: { companyId: c } });
  await prisma.pickListLine.deleteMany({ where: { pickList: { companyId: c } } });
  await prisma.pickList.deleteMany({ where: { companyId: c } });
  await prisma.fulfillmentAllocation.deleteMany({ where: { fulfillmentBatch: { companyId: c } } });
  await prisma.fulfillmentBatch.deleteMany({ where: { companyId: c } });
  await prisma.purchaseRequestLine.deleteMany({ where: { purchaseRequest: { companyId: c } } });
  await prisma.purchaseRequest.deleteMany({ where: { companyId: c } });
  await prisma.salesOrderLine.deleteMany({ where: { companyId: c } });
  await prisma.salesOrder.deleteMany({ where: { companyId: c } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId: c } });
  await prisma.stockLot.deleteMany({ where: { companyId: c } });
}
beforeEach(async () => {
  await cleanTransactions();
  await policy();
});
afterAll(async () => {
  await cleanTransactions();
  await cleanFinanceConfiguration(c);
  await prisma.transactionEvidence.deleteMany({ where: { companyId: c } });
  await prisma.salesTaxRule.deleteMany({ where: { companyId: c } });
  await prisma.productReferencePrice.deleteMany({ where: { companyId: c } });
  await prisma.customerPaymentPolicy.deleteMany({ where: { companyId: c } });
  await prisma.auditEvent.deleteMany({ where: { companyId: c } });
  await prisma.masterCodeSequence.deleteMany({ where: { companyId: c } });
  await prisma.documentNumberRule.deleteMany({ where: { companyId: c } });
  await prisma.policyVersion.deleteMany({ where: { policy: { companyId: c } } });
  await prisma.systemPolicy.deleteMany({ where: { companyId: c } });
  await prisma.product.deleteMany({ where: { companyId: c } });
  await prisma.customer.deleteMany({ where: { companyId: c } });
  await prisma.customerChannel.deleteMany({ where: { companyId: c } });
  await prisma.productCategory.deleteMany({ where: { companyId: c } });
  await prisma.uom.deleteMany({ where: { companyId: c } });
  await prisma.locator.deleteMany({ where: { companyId: c } });
  await prisma.warehouse.deleteMany({ where: { companyId: c } });
  await prisma.companyMembership.deleteMany({ where: { companyId: c } });
  await prisma.company.delete({ where: { id: c } });
  await prisma.user.deleteMany({ where: { id: { in: [actor, approver, outsider] } } });
});

it("reserves repeated product lines cumulatively and excludes expired/hold lots", async () => {
  const valid = await lot("10");
  await lot("100", "2000-01-01");
  await lot("100", "2090-01-01", "HOLD");
  const so = await order(["8", "8"]);
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const stocked = await prisma.stockLot.findUniqueOrThrow({ where: { id: valid.id } });
  expect(stocked.quantityReserved.toString()).toBe("10");
  const lines = await prisma.salesOrderLine.findMany({ where: { salesOrderId: so.id } });
  expect(lines.reduce((n, x) => n + Number(x.backorderQuantity), 0)).toBe(6);
  expect(await prisma.purchaseRequest.count({ where: { companyId: c } })).toBe(0);
});

it("recognizes configured advance tax once and keeps official evidence separate from commercial invoices", async () => {
  await prisma.salesTaxRule.updateMany({
    where: { companyId: c },
    data: { taxableEvent: "ADVANCE" },
  });
  try {
    await lot("2");
    const so = await order(["2"]);
    await service.submitSalesOrder(c, actor, so.id, randomUUID());
    const batch = await prisma.fulfillmentBatch.findFirstOrThrow({
      where: { salesOrderId: so.id },
      include: { pickList: { include: { lines: true } }, allocations: true },
    });
    const r = await service.createCustomerReceipt(
      c,
      actor,
      customerId,
      {
        amount: "22",
        currency: "IDR",
        bank_account_id: bankAccountId,
        fulfillment_batch_id: batch.id,
        evidence_id: evidence.PAYMENT,
        bank_reference: "ADVANCE-TAX-ONLY",
      },
      randomUUID(),
    );
    const advance = await prisma.advanceTax.findUniqueOrThrow({ where: { receiptId: r.id } });
    expect(advance.amount.toString()).toBe("2");
    const official = await createOfficialTaxDocument(
      c,
      actor,
      {
        source_type: "ADVANCE_TAX",
        source_id: advance.id,
        number: "TEST-OFFICIAL-ONLY",
        document_date: new Date().toISOString().slice(0, 10),
        evidence_id: evidence.TAX,
      },
      randomUUID(),
    );
    expect(official.state).toBe("PENDING_VERIFICATION");
    const journalCount = await prisma.financeJournal.count({ where: { companyId: c } });
    await verifyOfficialTaxDocument(
      c,
      approver,
      official.id,
      { decision: "VERIFIED", reason: "Synthetic proof reviewed" },
      randomUUID(),
    );
    expect(await prisma.financeJournal.count({ where: { companyId: c } })).toBe(journalCount);
    await service.confirmPick(c, actor, batch.pickList!.id, {
      lines: batch.pickList!.lines.map((l) => ({
        pick_list_line_id: l.id,
        picked_quantity: l.assignedQuantity.toString(),
      })),
    });
    await service.confirmCheck(c, actor, batch.pickList!.id);
    await operations.shipment(
      c,
      actor,
      batch.id,
      { driver: "TEST", vehicle: "TEST", planned_at: new Date().toISOString() },
      randomUUID(),
    );
    await service.dispatch(c, actor, batch.id);
    const pod = await service.confirmPod(c, actor, batch.id, {
      receiver_name: "TEST",
      evidence_id: evidence.POD,
      accepted_at: new Date().toISOString(),
      lines: [{ fulfillment_allocation_id: batch.allocations[0]!.id, accepted_quantity: "2" }],
    });
    const invoice = await service.postInvoice(c, actor, pod.id);
    expect(invoice.outstandingAmount.toString()).toBe("0");
    const tax = await prisma.ledgerEntry.aggregate({
      where: { companyId: c, kind: "SALES_TAX" },
      _sum: { credit: true },
    });
    expect(tax._sum.credit?.toString()).toBe("2");
    expect((await reconcileGl(c)).balanced).toBe(true);
  } finally {
    await prisma.salesTaxRule.updateMany({
      where: { companyId: c },
      data: { taxableEvent: "POD" },
    });
  }
});

it("settles verified WAPU and PPh separately, reconciles GL and closes only matched bank statements", async () => {
  await lot("2");
  const so = await order(["2"]);
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const batch = await prisma.fulfillmentBatch.findFirstOrThrow({
    where: { salesOrderId: so.id },
    include: { pickList: { include: { lines: true } } },
  });
  await service.confirmPick(
    c,
    actor,
    batch.pickList!.id,
    {
      lines: batch.pickList!.lines.map((l) => ({
        pick_list_line_id: l.id,
        picked_quantity: l.assignedQuantity.toString(),
      })),
    },
    randomUUID(),
  );
  await service.confirmCheck(c, actor, batch.pickList!.id, randomUUID());
  await operations.shipment(
    c,
    actor,
    batch.id,
    { driver: "TEST", vehicle: "TEST", planned_at: new Date().toISOString() },
    randomUUID(),
  );
  await service.dispatch(c, actor, batch.id, randomUUID());
  const allocation = await prisma.fulfillmentAllocation.findFirstOrThrow({
    where: { fulfillmentBatchId: batch.id },
  });
  const pod = await service.confirmPod(
    c,
    actor,
    batch.id,
    {
      accepted_at: new Date().toISOString(),
      receiver_name: "TEST",
      evidence_id: evidence.POD,
      lines: [
        {
          fulfillment_allocation_id: allocation.id,
          accepted_quantity: "2",
          returned_quantity: "0",
        },
      ],
    },
    randomUUID(),
  );
  const invoice = (await service.postInvoice(c, actor, pod.id, randomUUID()))!;
  for (const [kind, taxType, rate, expected] of [
    ["vat_collected_by_customer", "TEST-VAT", "0.1", "2"],
    ["income_tax_withheld", "TEST-PPH", "0.05", "1"],
  ]) {
    const rule = await financeConfigure(
      c,
      actor,
      "taxRule",
      {
        customer_id: customerId,
        kind,
        tax_type: taxType,
        rate,
        dpp_factor: "1",
        decimal_places: 2,
        rounding: "HALF_UP",
        legal_reference: "SYNTHETIC ONLY",
        effective_from: "2000-01-01",
        effective_to: "2100-01-01",
      },
      randomUUID(),
    );
    const component = await createTaxComponent(
      c,
      actor,
      {
        invoice_id: invoice.id,
        rule_id: rule.id,
        number: randomUUID(),
        document_date: new Date().toISOString().slice(0, 10),
        tax_period: new Date().toISOString().slice(0, 7),
        dpp: "20",
        evidence_id: evidence.TAX,
      },
      randomUUID(),
    );
    expect(component.amount.toString()).toBe(expected);
    await expect(
      taxComponentCommand(c, actor, component.id, "post", "test", randomUUID()),
    ).rejects.toThrow("TAX_EVIDENCE_NOT_VERIFIED");
    await taxComponentCommand(c, approver, component.id, "verify", "test", randomUUID());
    const key = randomUUID();
    await taxComponentCommand(c, actor, component.id, "post", "test", key);
    await taxComponentCommand(c, actor, component.id, "post", "test", key);
  }
  const receipt = await service.createCustomerReceipt(
    c,
    actor,
    customerId,
    {
      bank_account_id: bankAccountId,
      amount: "19",
      currency: "IDR",
      bank_reference: "TAX-TEST",
      evidence_id: evidence.PAYMENT,
    },
    randomUUID(),
  );
  await service.allocateCustomerReceipt(
    c,
    actor,
    receipt.id,
    { invoice_id: invoice.id, amount: "19" },
    randomUUID(),
  );
  expect(
    (
      await prisma.salesInvoice.findUniqueOrThrow({ where: { id: invoice.id } })
    ).outstandingAmount.toString(),
  ).toBe("0");
  expect((await reconcileGl(c)).balanced).toBe(true);
  const today = new Date().toISOString().slice(0, 10);
  const input = {
    bank_account_id: bankAccountId,
    starts_on: today,
    ends_on: today,
    opening_balance: "0",
    closing_balance: "19",
    lines: [
      {
        external_id: randomUUID(),
        reference: "TAX-TEST",
        value_date: today,
        amount: "19",
        description: "Synthetic settlement",
      },
    ],
  };
  const statement = await importStatement(c, actor, input, randomUUID());
  await expect(importStatement(c, actor, input, randomUUID())).rejects.toThrow();
  await expect(reviewStatement(c, actor, statement.id, true, randomUUID())).rejects.toThrow(
    "BANK_RECONCILIATION_BLOCKED",
  );
  await matchStatement(c, actor, statement.lines[0]!.id, receipt.id, randomUUID());
  expect((await reviewStatement(c, approver, statement.id, false, randomUUID())).ready).toBe(true);
  expect(
    (await reviewStatement(c, approver, statement.id, true, randomUUID())).statement.state,
  ).toBe("CLOSED");
  await expect(
    matchStatement(c, actor, statement.lines[0]!.id, receipt.id, randomUUID()),
  ).rejects.toThrow("BANK_MATCH_LOCKED");
});

it("rolls back a receipt when the fiscal period is closed or bank configuration is missing", async () => {
  await prisma.financePeriod.updateMany({ where: { companyId: c }, data: { state: "CLOSED" } });
  const i = {
    bank_account_id: bankAccountId,
    amount: "10",
    currency: "IDR",
    bank_reference: "BLOCKED",
    evidence_id: evidence.PAYMENT,
  };
  try {
    await expect(
      service.createCustomerReceipt(c, actor, customerId, i, randomUUID()),
    ).rejects.toThrow("FINANCE_PERIOD_NOT_OPEN");
    expect(await prisma.customerReceipt.count({ where: { companyId: c } })).toBe(0);
  } finally {
    await prisma.financePeriod.updateMany({ where: { companyId: c }, data: { state: "OPEN" } });
  }
  await expect(
    service.createCustomerReceipt(
      c,
      actor,
      customerId,
      { ...i, bank_account_id: undefined },
      randomUUID(),
    ),
  ).rejects.toThrow("BANK_ACCOUNT_REQUIRED");
  expect(await prisma.financeJournal.count({ where: { companyId: c } })).toBe(0);
});

it("allocates only remaining backorder under concurrent reevaluation and rechecks credit", async () => {
  await lot("3");
  const so = await order(["8"]);
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  await lot("20");
  await policy("40");
  await expect(service.submitSalesOrder(c, actor, so.id, randomUUID())).rejects.toThrow(
    "REALLOCATION_COMMAND_REQUIRED",
  );
  const heldVersion = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: so.id } })).version;
  await expect(
    service.submitSalesOrder(c, actor, so.id, randomUUID(), heldVersion),
  ).rejects.toThrow("CREDIT_HOLD");
  expect(await prisma.fulfillmentBatch.count({ where: { salesOrderId: so.id } })).toBe(1);
  await policy();
  const version = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: so.id } })).version;
  const results = await Promise.allSettled([
    service.submitSalesOrder(c, actor, so.id, randomUUID(), version),
    service.submitSalesOrder(c, actor, so.id, randomUUID(), version),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const line = await prisma.salesOrderLine.findFirstOrThrow({ where: { salesOrderId: so.id } });
  expect(line.orderedQuantity.toString()).toBe("8");
  expect(line.allocatedQuantity.toString()).toBe("8");
  expect(line.backorderQuantity.toString()).toBe("0");
  expect(await prisma.fulfillmentBatch.count({ where: { salesOrderId: so.id } })).toBe(2);
});

it("requires scoped multistep price approval and refuses stale, expired and self decisions", async () => {
  await lot("20");
  await exceptionPolicy("SPECIAL_PRICE");
  const so = await order(["2"], "8");
  const request = await requestException(
    c,
    actor,
    so.id,
    {
      kind: "SPECIAL_PRICE",
      version: so.version,
      line_id: so.lines[0]!.id,
      reasons: [],
      reason: "Synthetic price test",
      evidence_id: evidence.SALES_ORDER!,
      amount_limit: "16",
    },
    randomUUID(),
  );
  await expect(service.submitSalesOrder(c, actor, so.id, randomUUID())).rejects.toThrow(
    "PRICE_EXCEPTION_APPROVAL_REQUIRED",
  );
  await expect(
    decideException(c, actor, request.id, { decision: "APPROVED", reason: "test" }, randomUUID()),
  ).rejects.toThrow("SELF_APPROVAL_FORBIDDEN");
  await decideException(
    c,
    approver,
    request.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await expect(service.submitSalesOrder(c, actor, so.id, randomUUID())).rejects.toThrow(
    "PRICE_EXCEPTION_APPROVAL_REQUIRED",
  );
  await decideException(
    c,
    outsider,
    request.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await prisma.salesOrderLine.update({ where: { id: so.lines[0]!.id }, data: { unitPrice: "9" } });
  await expect(service.submitSalesOrder(c, actor, so.id, randomUUID())).rejects.toThrow(
    "PRICE_EXCEPTION_APPROVAL_REQUIRED",
  );
  await prisma.salesOrderLine.update({ where: { id: so.lines[0]!.id }, data: { unitPrice: "8" } });
  await prisma.salesExceptionRequest.update({
    where: { id: request.id },
    data: { expiresAt: new Date("2000-01-01") },
  });
  await expect(service.submitSalesOrder(c, actor, so.id, randomUUID())).rejects.toThrow(
    "PRICE_EXCEPTION_APPROVAL_REQUIRED",
  );
  await prisma.salesExceptionRequest.update({
    where: { id: request.id },
    data: { expiresAt: new Date("2090-01-01") },
  });
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const line = await prisma.salesOrderLine.findUniqueOrThrow({ where: { id: so.lines[0]!.id } });
  expect((line.priceSnapshot as { exception_id: string }).exception_id).toBe(request.id);
});

it("recovers approved evaluation after worker interruption without duplicating allocation", async () => {
  await lot("20");
  await exceptionPolicy("SPECIAL_PRICE");
  const so = await order(["2"], "8");
  const request = await requestException(
    c,
    actor,
    so.id,
    {
      kind: "SPECIAL_PRICE",
      version: so.version,
      line_id: so.lines[0]!.id,
      reasons: [],
      reason: "Outbox recovery test",
      evidence_id: evidence.SALES_ORDER!,
      amount_limit: "16",
    },
    randomUUID(),
  );
  await decideException(
    c,
    approver,
    request.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await decideException(
    c,
    outsider,
    request.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  expect((await processExceptionEvaluations(c, request.id))?.state).toBe("COMPLETED");
  await prisma.$executeRaw`UPDATE sales_exception_evaluations SET state='PROCESSING', available_at=now()-interval '1 minute' WHERE id=${request.id}::uuid`;
  expect((await processExceptionEvaluations(c, request.id))?.state).toBe("COMPLETED");
  expect(await prisma.fulfillmentBatch.count({ where: { salesOrderId: so.id } })).toBe(1);
  const line = await prisma.salesOrderLine.findUniqueOrThrow({ where: { id: so.lines[0]!.id } });
  expect(line.allocatedQuantity.toString()).toBe("2");
});

it("enforces posted journal immutability, company scope and balance in PostgreSQL", async () => {
  const receipt = await service.createCustomerReceipt(
    c,
    actor,
    customerId,
    {
      amount: "5",
      currency: "IDR",
      bank_account_id: bankAccountId,
      bank_reference: "DB-INVARIANT-TEST",
      evidence_id: evidence.PAYMENT,
    },
    randomUUID(),
  );
  const journal = await prisma.financeJournal.findFirstOrThrow({
    where: { companyId: c, sourceId: receipt.id },
    include: { lines: true },
  });
  const line = journal.lines[0]!;
  await expect(
    prisma.financeJournal.create({
      data: {
        companyId: c,
        sourceType: "QA_UNBALANCED",
        sourceId: randomUUID(),
        businessDate: journal.businessDate,
        periodId: journal.periodId,
        profileId: journal.profileId,
        currency: journal.currency,
        actorId: actor,
        lines: {
          create: {
            companyId: c,
            accountId: line.accountId,
            ledgerKind: "AR",
            debit: "1",
            credit: "0",
            snapshot: {},
          },
        },
      },
    }),
  ).rejects.toThrow("JOURNAL_UNBALANCED");
  await expect(
    prisma.financeJournalLine.update({ where: { id: line.id }, data: { debit: "100" } }),
  ).rejects.toThrow("POSTED_FINANCE_IMMUTABLE");
  await expect(
    prisma.financeJournal.update({ where: { id: journal.id }, data: { currency: "USD" } }),
  ).rejects.toThrow("POSTED_FINANCE_IMMUTABLE");
  await expect(
    prisma.financeJournalLine.create({
      data: {
        companyId: c,
        journalId: journal.id,
        accountId: line.accountId,
        ledgerKind: "AR",
        debit: "1",
        credit: "0",
        snapshot: {},
      },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.financeJournalLine.create({
      data: {
        companyId: randomUUID(),
        journalId: journal.id,
        accountId: line.accountId,
        ledgerKind: "AR",
        debit: "0",
        credit: "0",
        snapshot: {},
      },
    }),
  ).rejects.toThrow("JOURNAL_LINE_COMPANY_SCOPE_INVALID");
  expect(await prisma.financeJournalLine.count({ where: { journalId: journal.id } })).toBe(2);
});

it("matches split and combined bank receipts without exceeding either side", async () => {
  const makeReceipt = (amount: string) =>
    service.createCustomerReceipt(
      c,
      actor,
      customerId,
      {
        amount,
        currency: "IDR",
        bank_account_id: bankAccountId,
        bank_reference: randomUUID(),
        evidence_id: evidence.PAYMENT,
      },
      randomUUID(),
    );
  const one = await makeReceipt("10"),
    two = await makeReceipt("5");
  const date = new Date().toISOString().slice(0, 10);
  const statement = await importStatement(
    c,
    actor,
    {
      bank_account_id: bankAccountId,
      starts_on: date,
      ends_on: date,
      opening_balance: "0",
      closing_balance: "15",
      lines: [
        {
          external_id: "SPLIT-A",
          reference: "TEST",
          value_date: date,
          amount: "6",
          description: "QA",
        },
        {
          external_id: "SPLIT-B",
          reference: "TEST",
          value_date: date,
          amount: "9",
          description: "QA",
        },
      ],
    },
    randomUUID(),
  );
  const first = statement.lines.find((l) => l.externalId === "SPLIT-A")!,
    second = statement.lines.find((l) => l.externalId === "SPLIT-B")!;
  await matchStatement(c, actor, first.id, one.id, randomUUID(), "6");
  await expect(matchStatement(c, actor, second.id, one.id, randomUUID(), "5")).rejects.toThrow(
    "BANK_MATCH_AMOUNT_OR_ACCOUNT_MISMATCH",
  );
  expect((await reviewStatement(c, actor, statement.id, false, randomUUID())).ready).toBe(false);
  const key = randomUUID();
  await matchStatement(c, actor, second.id, one.id, key, "4");
  await matchStatement(c, actor, second.id, one.id, key, "4");
  await matchStatement(c, actor, second.id, two.id, randomUUID(), "5");
  expect((await reviewStatement(c, actor, statement.id, false, randomUUID())).ready).toBe(true);
  expect(
    (await reviewStatement(c, approver, statement.id, true, randomUUID())).statement.state,
  ).toBe("CLOSED");
  await expect(makeReceipt("1")).rejects.toThrow("BANK_RECONCILIATION_PERIOD_CLOSED");
});

it("blocks expired special prices before reallocating and shipping, and permits scoped renewal", async () => {
  await lot("1");
  await exceptionPolicy("SPECIAL_PRICE");
  const so = await order(["2"], "8");
  const input = {
    kind: "SPECIAL_PRICE" as const,
    version: so.version,
    line_id: so.lines[0]!.id,
    reasons: [],
    reason: "Price validity test",
    evidence_id: evidence.SALES_ORDER!,
    amount_limit: "16",
  };
  const request = await requestException(c, actor, so.id, input, randomUUID());
  await decideException(
    c,
    approver,
    request.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await decideException(
    c,
    outsider,
    request.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const b = await prisma.fulfillmentBatch.findFirstOrThrow({
    where: { salesOrderId: so.id },
    include: { pickList: { include: { lines: true } } },
  });
  await service.confirmPick(c, actor, b.pickList!.id, {
    lines: b.pickList!.lines.map((l) => ({
      pick_list_line_id: l.id,
      picked_quantity: l.assignedQuantity.toString(),
    })),
  });
  await service.confirmCheck(c, actor, b.pickList!.id);
  await operations.shipment(
    c,
    actor,
    b.id,
    { driver: "TEST", vehicle: "TEST", planned_at: new Date().toISOString() },
    randomUUID(),
  );
  await prisma.salesExceptionRequest.update({
    where: { id: request.id },
    data: { expiresAt: new Date("2000-01-01") },
  });
  const version = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: so.id } })).version;
  await expect(service.submitSalesOrder(c, actor, so.id, randomUUID(), version)).rejects.toThrow(
    "PRICE_EXCEPTION_APPROVAL_REQUIRED",
  );
  await expect(service.dispatch(c, actor, b.id)).rejects.toThrow(
    "PRICE_EXCEPTION_APPROVAL_REQUIRED",
  );
  const renewal = await requestException(c, actor, so.id, { ...input, version }, randomUUID());
  await decideException(
    c,
    approver,
    renewal.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await decideException(
    c,
    outsider,
    renewal.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await service.dispatch(c, actor, b.id);
  expect((await prisma.fulfillmentBatch.findUniqueOrThrow({ where: { id: b.id } })).state).toBe(
    "DISPATCHED",
  );
});

it("applies unlock only to approved reasons without changing master limit or stock eligibility", async () => {
  await policy("1");
  await exceptionPolicy("SALES_ORDER_UNLOCK");
  await lot("2");
  await lot("30", "2090-01-01", "HOLD");
  const so = await order(["5"]);
  const input = {
    kind: "SALES_ORDER_UNLOCK" as const,
    version: so.version,
    reasons: ["CREDIT_HOLD"],
    reason: "Test credit exception",
    evidence_id: evidence.SALES_ORDER!,
    amount_limit: "55",
  };
  await expect(
    requestException(
      c,
      actor,
      so.id,
      { ...input, reasons: ["CUSTOMER_CREDIT_FROZEN"] },
      randomUUID(),
    ),
  ).rejects.toThrow("UNLOCK_SCOPE_NOT_ALLOWED");
  const request = await requestException(c, actor, so.id, input, randomUUID());
  await decideException(
    c,
    approver,
    request.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await decideException(
    c,
    outsider,
    request.id,
    { decision: "APPROVED", reason: "test" },
    randomUUID(),
  );
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const line = await prisma.salesOrderLine.findFirstOrThrow({ where: { salesOrderId: so.id } });
  expect(line.allocatedQuantity.toString()).toBe("2");
  expect(line.backorderQuantity.toString()).toBe("3");
  expect(
    (
      await prisma.customerPaymentPolicy.findFirstOrThrow({ where: { companyId: c, active: true } })
    ).creditLimit?.toString(),
  ).toBe("1");
  const next = await order(["1"]);
  await expect(service.submitSalesOrder(c, actor, next.id, randomUUID())).rejects.toThrow(
    "CREDIT_HOLD",
  );
  await policy("1");
  const staleVersion = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: so.id } }))
    .version;
  await expect(
    service.submitSalesOrder(c, actor, so.id, randomUUID(), staleVersion),
  ).rejects.toThrow("CREDIT_HOLD");
});

it("keeps FEFO deterministic and prevents duplicate parallel submit", async () => {
  const late = await lot("10", "2095-01-01"),
    early = await lot("10", "2090-01-01");
  const so = await order(["8"]);
  await Promise.all([
    service.submitSalesOrder(c, actor, so.id, randomUUID()),
    service.submitSalesOrder(c, actor, so.id, randomUUID()),
  ]);
  expect(await prisma.fulfillmentBatch.count({ where: { salesOrderId: so.id } })).toBe(1);
  expect(
    (
      await prisma.stockLot.findUniqueOrThrow({ where: { id: early.id } })
    ).quantityReserved.toString(),
  ).toBe("8");
  expect(
    (
      await prisma.stockLot.findUniqueOrThrow({ where: { id: late.id } })
    ).quantityReserved.toString(),
  ).toBe("0");
});

it("serializes concurrent credit commitments and does not charge backorders", async () => {
  await policy("100");
  await lot("100");
  const a = await order(),
    b = await order();
  const results = await Promise.allSettled([
    service.submitSalesOrder(c, actor, a.id, randomUUID()),
    service.submitSalesOrder(c, actor, b.id, randomUUID()),
  ]);
  expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(
    (await prisma.$transaction((tx) => creditExposure(tx, c, customerId, "IDR"))).total.toString(),
  ).toBe("88");
  await cleanTransactions();
  await lot("1");
  const big = await order(["100"]);
  await service.submitSalesOrder(c, actor, big.id, randomUUID());
  expect(
    (await prisma.$transaction((tx) => creditExposure(tx, c, customerId, "IDR"))).total.toString(),
  ).toBe("11");
});

it("blocks price mismatch, missing tax and frozen customer with no reservation side effects", async () => {
  await lot("10");
  const wrong = await order(["1"], "1");
  await expect(service.submitSalesOrder(c, actor, wrong.id, randomUUID())).rejects.toThrow(
    "PRICE_EXCEPTION_APPROVAL_REQUIRED",
  );
  const rule = await prisma.salesTaxRule.findFirstOrThrow({ where: { companyId: c } });
  await prisma.salesTaxRule.update({
    where: { id: rule.id },
    data: { effectiveTo: new Date("2021-01-01") },
  });
  const so = await order(["1"]);
  await expect(service.submitSalesOrder(c, actor, so.id, randomUUID())).rejects.toThrow(
    "TAX_POLICY_REQUIRED",
  );
  await prisma.salesTaxRule.update({
    where: { id: rule.id },
    data: { effectiveTo: new Date("2099-01-01") },
  });
  await prisma.customerPaymentPolicy.updateMany({
    where: { companyId: c },
    data: { frozen: true },
  });
  await expect(service.submitSalesOrder(c, actor, so.id, randomUUID())).rejects.toThrow(
    "CUSTOMER_CREDIT_FROZEN",
  );
  expect(await prisma.fulfillmentBatch.count({ where: { companyId: c } })).toBe(0);
});

it("runs SO through POD, taxed invoice and payment without double recognition and retains TOP snapshot", async () => {
  await lot("10");
  const so = await order(["2"]);
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const batch = await prisma.fulfillmentBatch.findFirstOrThrow({
    where: { salesOrderId: so.id },
    include: { allocations: true, pickList: { include: { lines: true } } },
  });
  await prisma.fulfillmentBatch.update({
    where: { id: batch.id },
    data: {
      shipmentSnapshot: { driver: "Test", vehicle: "Test", planned_at: new Date().toISOString() },
    },
  });
  await expect(service.dispatch(c, actor, batch.id)).rejects.toThrow("PICKING_CHECK_REQUIRED");
  await service.confirmPick(c, actor, batch.pickList!.id, {
    lines: batch.pickList!.lines.map((l) => ({
      pick_list_line_id: l.id,
      picked_quantity: l.assignedQuantity.toString(),
    })),
  });
  await service.confirmCheck(c, actor, batch.pickList!.id);
  await service.dispatch(c, actor, batch.id);
  expect(
    (await prisma.$transaction((tx) => creditExposure(tx, c, customerId, "IDR"))).total.toString(),
  ).toBe("22");
  const pod = await service.confirmPod(c, actor, batch.id, {
    receiver_name: "Test receiver",
    evidence_id: evidence.POD,
    accepted_at: "2026-10-05T01:00:00.000Z",
    lines: [{ fulfillment_allocation_id: batch.allocations[0]!.id, accepted_quantity: "2" }],
  });
  await prisma.customerPaymentPolicy.updateMany({ where: { companyId: c }, data: { topDays: 90 } });
  const inv = await service.postInvoice(c, actor, pod.id);
  expect(inv.subtotal.toString()).toBe("20");
  expect(inv.taxAmount.toString()).toBe("2");
  expect(inv.outstandingAmount.toString()).toBe("22");
  expect(inv.dueDate.toISOString().slice(0, 10)).toBe("2026-11-04");
  expect((await service.postInvoice(c, actor, pod.id)).id).toBe(inv.id);
  const receipt = await service.createCustomerReceipt(
    c,
    actor,
    customerId,
    {
      amount: "22",
      currency: "IDR",
      bank_account_id: bankAccountId,
      evidence_id: evidence.PAYMENT,
      bank_reference: "TEST-BANK",
    },
    randomUUID(),
  );
  await service.allocateCustomerReceipt(c, actor, receipt.id, { invoice_id: inv.id, amount: "22" });
  expect(
    (await prisma.$transaction((tx) => creditExposure(tx, c, customerId, "IDR"))).total.toString(),
  ).toBe("0");
  const entries = await prisma.ledgerEntry.findMany({ where: { companyId: c } });
  expect(entries.reduce((v, x) => v + Number(x.debit) - Number(x.credit), 0)).toBe(0);
  expect(entries.filter((x) => x.kind === "SALE_REVENUE")).toHaveLength(1);
});


it("requires assigned approver, separation of duties, limit and all approval steps", async () => {
  const request = await prisma.purchaseRequest.create({
    data: {
      companyId: c,
      number: randomUUID(),
      state: "SUBMITTED",
      createdById: actor,
      approvalValue: "100",
      currency: "IDR",
    },
  });
  await expect(service.approvePurchaseRequest(c, actor, request.id)).rejects.toThrow(
    "APPROVAL_POLICY_REQUIRED_OR_CONFLICTING",
  );
  await prisma.transactionApprovalPolicy.create({
    data: {
      companyId: c,
      documentKind: "PURCHASE_REQUEST",
      currency: "IDR",
      maximumAmount: "100",
      steps: [{ mode: "ALL", user_ids: [actor, approver] }],
      effectiveFrom: new Date("2020-01-01"),
      effectiveTo: new Date("2099-01-01"),
      createdById: actor,
    },
  });
  await expect(service.approvePurchaseRequest(c, actor, request.id)).rejects.toThrow(
    "SELF_APPROVAL_FORBIDDEN",
  );
  await expect(service.approvePurchaseRequest(c, outsider, request.id)).rejects.toThrow(
    "APPROVER_NOT_ASSIGNED",
  );
  const policy = await prisma.transactionApprovalPolicy.findFirstOrThrow({
    where: { companyId: c },
  });
  await prisma.transactionApprovalPolicy.update({
    where: { id: policy.id },
    data: { steps: [{ mode: "ALL", user_ids: [approver, outsider] }] },
  });
  expect((await service.approvePurchaseRequest(c, approver, request.id)).state).toBe("SUBMITTED");
  expect((await service.approvePurchaseRequest(c, outsider, request.id)).state).toBe("APPROVED");
  const over = await prisma.purchaseRequest.create({
    data: {
      companyId: c,
      number: randomUUID(),
      state: "SUBMITTED",
      createdById: actor,
      approvalValue: "101",
    },
  });
  await expect(service.approvePurchaseRequest(c, approver, over.id)).rejects.toThrow(
    "APPROVAL_LIMIT_EXCEEDED",
  );
});

it("replays a receipt once, rejects changed payload and missing or wrong-purpose evidence", async () => {
  const key = randomUUID();
  const input = {
    amount: "22",
    currency: "IDR",
    bank_account_id: bankAccountId,
    evidence_id: evidence.PAYMENT,
    bank_reference: "TEST",
  };
  const first = await service.createCustomerReceipt(c, actor, customerId, input, key);
  expect((await service.createCustomerReceipt(c, actor, customerId, input, key)).id).toBe(first.id);
  await expect(
    service.createCustomerReceipt(c, actor, customerId, { ...input, amount: "23" }, key),
  ).rejects.toThrow("IDEMPOTENCY_PAYLOAD_MISMATCH");
  await expect(
    service.createCustomerReceipt(
      c,
      actor,
      customerId,
      { ...input, evidence_id: evidence.POD },
      randomUUID(),
    ),
  ).rejects.toThrow("PAYMENT_EVIDENCE_REQUIRED");
  await expect(
    service.createCustomerReceipt(
      c,
      actor,
      customerId,
      { ...input, evidence_id: randomUUID() },
      randomUUID(),
    ),
  ).rejects.toThrow("PAYMENT_EVIDENCE_REQUIRED");
  expect(await prisma.customerReceipt.count({ where: { companyId: c } })).toBe(1);
  const so = await order(["1"]);
  await expect(operations.order(randomUUID(), so.id)).rejects.toThrow();
  const other = randomUUID();
  await prisma.company.create({ data: { id: other, name: "FOREIGN TEST" } });
  await prisma.companyMembership.create({ data: { companyId: other, userId: actor } });
  const foreign = await prisma.transactionEvidence.create({
    data: {
      companyId: other,
      actorId: actor,
      purpose: "PAYMENT",
      originalName: "TEST",
      objectKey: "TEST",
      sha256: "TEST",
      sizeBytes: 1,
    },
  });
  try {
    await expect(
      service.createCustomerReceipt(
        c,
        actor,
        customerId,
        { ...input, evidence_id: foreign.id },
        randomUUID(),
      ),
    ).rejects.toThrow("PAYMENT_EVIDENCE_REQUIRED");
  } finally {
    await prisma.transactionEvidence.delete({ where: { id: foreign.id } });
    await prisma.companyMembership.deleteMany({ where: { companyId: other } });
    await prisma.company.delete({ where: { id: other } });
  }
});

it("rechecks lot eligibility at dispatch and requires shipment documents", async () => {
  const stocked = await lot("4");
  const so = await order(["2"]);
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const b = await prisma.fulfillmentBatch.findFirstOrThrow({
    where: { salesOrderId: so.id },
    include: { pickList: { include: { lines: true } } },
  });
  await service.confirmPick(c, actor, b.pickList!.id, {
    lines: b.pickList!.lines.map((l) => ({
      pick_list_line_id: l.id,
      picked_quantity: l.assignedQuantity.toString(),
    })),
  });
  await service.confirmCheck(c, actor, b.pickList!.id);
  await expect(service.dispatch(c, actor, b.id)).rejects.toThrow("SHIPMENT_DETAILS_REQUIRED");
  await operations.shipment(
    c,
    actor,
    b.id,
    { driver: "TEST", vehicle: "TEST", planned_at: new Date().toISOString() },
    randomUUID(),
  );
  await operations.quality(
    c,
    actor,
    stocked.id,
    { state: "HOLD", reason: "TEST inspection" },
    randomUUID(),
  );
  await expect(service.dispatch(c, actor, b.id)).rejects.toThrow();
  expect(
    (
      await prisma.stockLot.findUniqueOrThrow({ where: { id: stocked.id } })
    ).quantityOnHand.toString(),
  ).toBe("4");
  await operations.quality(
    c,
    actor,
    stocked.id,
    { state: "AVAILABLE", reason: "TEST release" },
    randomUUID(),
  );
  await prisma.stockLot.update({
    where: { id: stocked.id },
    data: { expiryDate: new Date("2000-01-01") },
  });
  await expect(service.dispatch(c, actor, b.id)).rejects.toThrow();
  expect(
    await prisma.fulfillmentDocument.count({ where: { companyId: c, kind: "SURAT_JALAN" } }),
  ).toBe(0);
});

it("quarantines POD returns, balances transit, blocks overdue until invoice is paid", async () => {
  await lot("4");
  const so = await order(["2"]);
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const b = await prisma.fulfillmentBatch.findFirstOrThrow({
    where: { salesOrderId: so.id },
    include: { allocations: true, pickList: { include: { lines: true } } },
  });
  await operations.shipment(
    c,
    actor,
    b.id,
    { driver: "TEST", vehicle: "TEST", planned_at: new Date().toISOString() },
    randomUUID(),
  );
  await service.confirmPick(c, actor, b.pickList!.id, {
    lines: b.pickList!.lines.map((l) => ({
      pick_list_line_id: l.id,
      picked_quantity: l.assignedQuantity.toString(),
    })),
  });
  await service.confirmCheck(c, actor, b.pickList!.id);
  await service.dispatch(c, actor, b.id);
  const input = {
    receiver_name: "TEST",
    evidence_id: evidence.POD,
    lines: [
      {
        fulfillment_allocation_id: b.allocations[0]!.id,
        accepted_quantity: "1",
        returned_quantity: "1",
      },
    ],
  };
  await expect(service.confirmPod(c, actor, b.id, input)).rejects.toThrow(
    "RETURN_QUARANTINE_LOCATOR_REQUIRED",
  );
  const quarantine = await prisma.locator.create({
    data: { ...master(), warehouseId, locatorType: "QUARANTINE" },
  });
  const pod = await service.confirmPod(c, actor, b.id, {
    ...input,
    quarantine_locator_id: quarantine.id,
    accepted_at: "2020-01-01T00:00:00.000Z",
  });
  const invoice = await service.postInvoice(c, actor, pod.id);
  expect(
    await prisma.stockLot.count({
      where: {
        companyId: c,
        locatorId: quarantine.id,
        qualityState: "QUARANTINE",
        quantityOnHand: "1",
      },
    }),
  ).toBe(1);
  const next = await order(["1"]);
  await expect(service.submitSalesOrder(c, actor, next.id, randomUUID())).rejects.toThrow(
    "CUSTOMER_PAST_DUE",
  );
  const r = await service.createCustomerReceipt(
    c,
    actor,
    customerId,
    {
      amount: "11",
      currency: "IDR",
      bank_account_id: bankAccountId,
      evidence_id: evidence.PAYMENT,
      bank_reference: "TEST",
    },
    randomUUID(),
  );
  const results = await Promise.allSettled([
    service.allocateCustomerReceipt(c, actor, r.id, { invoice_id: invoice.id, amount: "11" }),
    service.allocateCustomerReceipt(c, actor, r.id, { invoice_id: invoice.id, amount: "11" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await service.submitSalesOrder(c, actor, next.id, randomUUID());
  const journal = await prisma.ledgerEntry.findMany({ where: { companyId: c } });
  expect(journal.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0)).toBe(0);
});
it("outbound UI draft persists with revision and rejects invalid checking", async () => {
  await prisma.salesTaxRule.updateMany({ where: { companyId: c }, data: { state: "ACTIVE" } });
  await prisma.documentNumberRule.createMany({ data: ["sales_order", "fulfillment", "document_PICKING", "document_PACKING", "document_PROFORMA"].map(documentKind => ({ companyId: c, documentKind, prefix: `${documentKind}-`, digits: 6, resetYearly: true, effectiveFrom: new Date("2020-01-01"), effectiveTo: new Date("2099-01-01"), createdById: actor })) });
  await lot("2");
  const so = await order(["2"]);
  await service.submitSalesOrder(c, actor, so.id, randomUUID());
  const batch = await prisma.fulfillmentBatch.findFirstOrThrow({ where: { salesOrderId: so.id } });
  await service.createPickingSlip(c, actor, batch.id, randomUUID());
  const pick = await prisma.pickList.findFirstOrThrow({ where: { fulfillmentBatchId: batch.id }, include: { lines: true } });
  const input = { version: pick.version, lines: pick.lines.map(l => ({ pick_list_line_id: l.id, picked_quantity: l.assignedQuantity.toString() })) };
  await expect(service.confirmPick(c, actor, pick.id, { lines: input.lines }, randomUUID(), true)).rejects.toThrow("PICK_REVISION_OR_STATE_CHANGED");
  const key = randomUUID();
  const draft = await service.confirmPick(c, actor, pick.id, input, key, true);
  expect(draft.state).toBe("OPEN");
  expect(draft.pickedAt).toBeNull();
  expect(draft.version).toBe(pick.version + 1);
  await service.confirmPick(c, actor, pick.id, input, key, true);
  await expect(service.confirmPick(c, actor, pick.id, input, randomUUID(), true)).rejects.toThrow("PICK_REVISION_OR_STATE_CHANGED");
  await service.confirmPick(c, actor, pick.id, { ...input, version: draft.version }, randomUUID());
  const checks = input.lines.map(l => ({ pick_list_line_id: l.pick_list_line_id, checked_quantity: l.picked_quantity, condition: "BAIK" }));
  await expect(service.confirmCheck(c, actor, pick.id, { checks: checks.map(l => ({ ...l, checked_quantity: "0" })) }, randomUUID())).rejects.toThrow("CHECK_QTY_MISMATCH");
  await expect(service.confirmCheck(c, actor, pick.id, { checks: checks.map(l => ({ ...l, condition: "RUSAK" })) }, randomUUID())).rejects.toThrow("CHECK_CONDITION_REQUIRES_RESOLUTION");
  await service.confirmCheck(c, actor, pick.id, { checks }, randomUUID());
  expect((await prisma.pickList.findUniqueOrThrow({ where: { id: pick.id } })).state).toBe("CHECKED");
  const preview = await previewProforma(c, batch.id);
  const document = await issueProforma(c, actor, batch.id, { version: preview.version }, randomUUID());
  const proof = await prisma.transactionEvidence.create({ data: { companyId: c, actorId: actor, purpose: "PROFORMA_HANDOFF", originalName: "TEST-ONLY.png", objectKey: "TEST-ONLY", sha256: "TEST-ONLY", sizeBytes: 1 } });
  const handoff = { delivered_at: new Date(Date.now()-1000).toISOString(), delivered_by: "Test collector", recipient: "Test recipient", medium: "IN_PERSON", evidence_id: proof.id, promise_date: null };
  await expect(saveHandoff(c, actor, "proforma", document.id, { ...handoff, evidence_id: evidence.PAYMENT }, randomUUID())).rejects.toThrow("Bukti terima");
  const replay = randomUUID();
  const saved = await saveHandoff(c, actor, "proforma", document.id, handoff, replay);
  expect((await saveHandoff(c, actor, "proforma", document.id, handoff, replay)).id).toBe(saved.id);
  expect(await listHandoffs(c, "proforma", document.id)).toHaveLength(1);
  await expect(listHandoffs(randomUUID(), "proforma", document.id)).rejects.toThrow();

});
