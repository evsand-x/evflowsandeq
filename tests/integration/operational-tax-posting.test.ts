import type * as Database from "@evflow/database";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@evflow/database";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { saveTax, recordTaxInvoice } from "../../packages/backend/src/finance/operational-tax";
import { financeFixture } from "./finance-fixture";
// Real database and domain commands, all enclosed in a rollback-only transaction.
const context = vi.hoisted(() => ({ tx: null as Prisma.TransactionClient | null }));
vi.mock("@evflow/database", async (original) => {
  const module = await original<typeof Database>();
  return {
    ...module,
    prisma: new Proxy(module.prisma, {
      get(target, key) {
        if (context.tx && key === "$transaction")
          return async (action: unknown) =>
            typeof action === "function"
              ? action(context.tx)
              : Promise.all(action as Promise<unknown>[]);
        const client = context.tx ?? target;
        const value = Reflect.get(client, key);
        return typeof value === "function" ? value.bind(client) : value;
      },
    }),
  };
});
const service = new OtcPtpService(new AuditService());
const c = randomUUID(),
  actor = randomUUID(),
  approver = randomUUID(),
  outsider = randomUUID();
let productId: string, customerId: string, locatorId: string, warehouseId: string, uomId: string;
const evidence: Record<string, string> = {};
const master = () => ({
  companyId: c,
  code: randomUUID(),
  name: randomUUID(),
  normalizedName: randomUUID(),
  state: "ACTIVE" as const,
  createdById: actor,
  updatedById: actor,
});
async function setup() {
  await prisma.company.create({ data: { id: c, name: "OTC CONTROL TEST ONLY" } });
  for (const id of [actor, approver, outsider]) {
    await prisma.user.create({
      data: { id, email: `${id}@test.local`, displayName: "Test", passwordHash: "disabled" },
    });
    await prisma.companyMembership.create({ data: { companyId: c, userId: id } });
  }
  await financeFixture(c, actor);
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
}

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
it("posts frozen master tax to its selected account and records metadata without reposting", async () => {
  if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const actual = await vi.importActual<typeof Database>("@evflow/database");
  const rollback = new Error("ROLLBACK_TEST_FIXTURE");
  try {
    await actual.prisma.$transaction(
      async (tx) => {
        context.tx = tx;
        await setup();
        await policy();
        await prisma.documentNumberRule.createMany({
          data: [
            "sales_order",
            "fulfillment",
            "document_PICKING",
            "document_PACKING",
            "document_SURAT_JALAN",
            "sales_invoice",
            "supplier_invoice",
          ].map((documentKind) => ({
            companyId: c,
            documentKind,
            prefix: `${documentKind}-`,
            digits: 6,
            resetPeriod: "YEARLY",
            effectiveFrom: new Date("2020-01-01"),
            effectiveTo: new Date("2099-01-01"),
            createdById: actor,
          })),
        });
        const account = await prisma.financeAccount.create({
          data: {
            companyId: c,
            code: `TAX-${randomUUID()}`,
            name: "Selected tax account",
            category: "LIABILITY",
          },
        });
        const input = {
          name: "Operational PPN",
          usage: "SALES",
          kind: "PPN",
          effect: "ADD",
          account_id: account.id,
          percentage: "10",
          decimal_places: 2,
          rounding: "HALF_UP",
          active: true,
          effective_from: "2020-01-01T00:00:00.000Z",
        };
        const tax = await saveTax(c, actor, input, randomUUID());
        await lot("10");
        const so = await service.createSalesOrder(
          c,
          actor,
          {
            customer_id: customerId,
            customer_reference: randomUUID(),
            delivery_address: "Test",
            evidence_id: evidence.SALES_ORDER,
            currency: "IDR",
            lines: [
              { product_id: productId, quantity: "2", unit_price: "10", tax_master_id: tax.id },
            ],
          },
          randomUUID(),
        );
        await service.submitSalesOrder(c, actor, so.id, randomUUID());
        const batchRef = await prisma.fulfillmentBatch.findFirstOrThrow({
          where: { salesOrderId: so.id },
        });
        await service.createPickingSlip(c, actor, batchRef.id, randomUUID());
        const batch = await prisma.fulfillmentBatch.findFirstOrThrow({
          where: { id: batchRef.id },
          include: { allocations: true, pickList: { include: { lines: true } } },
        });
        await prisma.fulfillmentBatch.update({
          where: { id: batch.id },
          data: {
            shipmentSnapshot: {
              driver: "Test",
              vehicle: "Test",
              planned_at: new Date().toISOString(),
            },
          },
        });
        await service.confirmPick(
          c,
          actor,
          batch.pickList!.id,
          {
            version: batch.pickList!.version,
            lines: batch.pickList!.lines.map((line) => ({
              pick_list_line_id: line.id,
              picked_quantity: line.assignedQuantity.toString(),
            })),
          },
          randomUUID(),
        );
        await service.confirmCheck(
          c,
          actor,
          batch.pickList!.id,
          {
            checks: batch.pickList!.lines.map((line) => ({
              pick_list_line_id: line.id,
              checked_quantity: line.assignedQuantity.toString(),
              condition: "BAIK",
            })),
          },
          randomUUID(),
        );
        await service.dispatch(c, actor, batch.id);
        await saveTax(
          c,
          actor,
          { ...input, percentage: "20", effective_from: new Date().toISOString() },
          randomUUID(),
          tax.id,
          1,
        );
        const pod = await service.confirmPod(c, actor, batch.id, {
          receiver_name: "Test",
          evidence_id: evidence.POD,
          accepted_at: "2026-10-05T01:00:00.000Z",
          lines: [{ fulfillment_allocation_id: batch.allocations[0]!.id, accepted_quantity: "2" }],
        });
        const invoice = await service.postInvoice(c, actor, pod.id);
        expect(invoice.taxAmount.toString()).toBe("2");
        const posted = await prisma.financeJournalLine.findMany({
          where: { companyId: c, accountId: account.id },
        });
        expect(
          posted.reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0),
        ).toBe(2);
        const attachment = await prisma.transactionEvidence.create({
          data: {
            companyId: c,
            actorId: actor,
            purpose: "TAX_OUTPUT",
            originalName: "tax-test.png",
            objectKey: "integration-only",
            sha256: "test",
            sizeBytes: 1,
          },
        });
        const body = {
          number: `TAX-${randomUUID()}`,
          document_date: "2026-10-05",
          evidence_id: attachment.id,
          version: 0,
        };
        const key = randomUUID();
        const ledgerCount = await prisma.ledgerEntry.count({ where: { companyId: c } });
        const document = await recordTaxInvoice(c, actor, "OUTPUT", invoice.id, body, key);
        expect((await recordTaxInvoice(c, actor, "OUTPUT", invoice.id, body, key)).id).toBe(
          document.id,
        );
        expect(await prisma.ledgerEntry.count({ where: { companyId: c } })).toBe(ledgerCount);
        await expect(
          recordTaxInvoice(c, actor, "OUTPUT", invoice.id, body, randomUUID()),
        ).rejects.toThrow("TAX_VERSION_CONFLICT");

        const supplier = await prisma.supplier.create({ data: { ...master(), categories: [] } });
        const po = await prisma.purchaseOrder.create({
          data: {
            companyId: c,
            supplierId: supplier.id,
            warehouseId,
            number: randomUUID(),
            state: "COMPLETED",
            lines: {
              create: { productId, orderedQuantity: "2", receivedQuantity: "2", unitCost: "10" },
            },
          },
          include: { lines: true },
        });
        const withholding = await saveTax(
          c,
          actor,
          {
            ...input,
            usage: "PURCHASE",
            name: "Input withholding",
            kind: "PPH",
            effect: "DEDUCT",
            percentage: "2",
          },
          randomUUID(),
        );
        const purchase = await service.createSupplierInvoice(
          c,
          actor,
          po.id,
          {
            supplier_invoice_number: randomUUID(),
            invoice_date: "2026-10-05",
            due_date: "2026-11-05",
            currency: "IDR",
            tax_master_id: withholding.id,
            lines: [{ purchase_order_line_id: po.lines[0]!.id, quantity: "2", unit_cost: "10" }],
          },
          randomUUID(),
        );
        expect(purchase.taxAmount.toString()).toBe("-0.4");
        expect(purchase.total.toString()).toBe("19.6");
        const inputEvidence = await prisma.transactionEvidence.create({
          data: {
            companyId: c,
            actorId: actor,
            purpose: "TAX_INPUT",
            originalName: "input.png",
            objectKey: "integration-only",
            sha256: "test",
            sizeBytes: 1,
          },
        });
        const inputBody = { ...body, evidence_id: inputEvidence.id };
        await expect(
          recordTaxInvoice(c, actor, "INPUT", purchase.id, inputBody, randomUUID()),
        ).rejects.toThrow("TAX_SOURCE_NOT_POSTED");
        await service.postSupplierInvoice(c, actor, purchase.id);
        const inputTax = await prisma.financeJournalLine.findMany({
          where: { companyId: c, accountId: account.id, ledgerKind: "PURCHASE_TAX" },
        });
        expect(inputTax[0]!.credit.toString()).toBe("0.4");
        await expect(
          recordTaxInvoice(c, actor, "INPUT", purchase.id, body, randomUUID()),
        ).rejects.toThrow();
        const beforeMetadata = await prisma.ledgerEntry.count({ where: { companyId: c } });
        const inputDocument = await recordTaxInvoice(
          c,
          actor,
          "INPUT",
          purchase.id,
          inputBody,
          randomUUID(),
        );
        expect(inputDocument.direction).toBe("INPUT");
        expect(await prisma.ledgerEntry.count({ where: { companyId: c } })).toBe(beforeMetadata);
        throw rollback;
      },
      { timeout: 60000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    context.tx = null;
  }
  expect(await actual.prisma.company.findUnique({ where: { id: c } })).toBeNull();
}, 60000);
