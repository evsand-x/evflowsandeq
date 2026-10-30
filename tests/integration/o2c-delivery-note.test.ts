import { randomUUID } from "node:crypto";
import { prisma, Prisma, type Prisma as PrismaTypes } from "@evflow/database";
import {
  createDeliveryNote,
  updateDeliveryNoteDraft,
  issueDeliveryNote,
  getDeliveryNote,
} from "../../packages/backend/src/sales/delivery-note";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { OperationsService } from "../../packages/backend/src/sales/operations.service";

const realTransaction = prisma.$transaction.bind(prisma);
const rollback = new Error("rollback SJ fixture");
async function fixture(run: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database only");
  await realTransaction(
    async (tx) => {
      const f = await setup(tx);
      let command = 0;
      const stub = vi.spyOn(prisma, "$transaction").mockImplementation(async (fn: unknown) => {
        if (typeof fn !== "function") throw new Error("Unexpected array transaction");
        const savepoint = `sj_command_${++command}`;
        await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
        try {
          const result = await fn(tx);
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
          return result;
        } catch (error) {
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
          throw error;
        }
      });
      try {
        await run(f);
      } finally {
        stub.mockRestore();
      }
      throw rollback;
    },
    { timeout: 60000 },
  ).catch((e) => {
    if (e !== rollback) throw e;
  });
}
async function setup(tx: PrismaTypes.TransactionClient) {
  const c = (await tx.company.create({ data: { name: "SJ TEST" } })).id;
  const a = (
    await tx.user.create({
      data: {
        email: `${randomUUID()}@test.invalid`,
        displayName: "Tester",
        passwordHash: "disabled",
      },
    })
  ).id;
  await tx.companyMembership.create({ data: { companyId: c, userId: a } });
  const master = () => ({
    companyId: c,
    code: randomUUID(),
    name: randomUUID(),
    normalizedName: randomUUID(),
    state: "ACTIVE" as const,
    createdById: a,
    updatedById: a,
  });
  const channel = await tx.customerChannel.create({ data: master() });
  const customer = await tx.customer.create({ data: { ...master(), channelId: channel.id } });
  const w = await tx.warehouse.create({ data: { ...master(), timezone: "UTC" } });
  const loc = await tx.locator.create({
    data: { ...master(), warehouseId: w.id, locatorType: "STORAGE" },
  });
  const uom = await tx.uom.create({ data: master() });
  const altUom = await tx.uom.create({ data: master() });
  const cat = await tx.productCategory.create({ data: master() });
  const p = await tx.product.create({
    data: { ...master(), baseUomId: uom.id, categoryId: cat.id, expiryRequired: false },
  });
  const lot = await tx.stockLot.create({
    data: {
      companyId: c,
      productId: p.id,
      warehouseId: w.id,
      locatorId: loc.id,
      batchNo: randomUUID(),
      qualityState: "AVAILABLE",
      quantityOnHand: "10",
      unitCost: "3",
    },
  });
  const account = await tx.financeAccount.create({
    data: { companyId: c, code: "SJ", name: "Test", category: "ASSET" },
  });
  const tax = {
    rule_id: randomUUID(),
    rate: "0.1",
    dpp_factor: "1",
    decimal_places: 2,
    rounding: "HALF_UP",
    account_id: account.id,
  };
  const order = await tx.salesOrder.create({
    data: {
      companyId: c,
      customerId: customer.id,
      number: randomUUID(),
      state: "OPEN",
      warehouseId: w.id,
      createdById: a,
      paymentSnapshot: { term_code: "N30", mode: "TEMPO", top_days: 30 },
      lines: {
        create: {
          companyId: c,
          productId: p.id,
          orderedQuantity: "10",
          unitPrice: "10",
          taxSnapshot: tax,
        },
      },
    },
    include: { lines: true },
  });
  await tx.documentNumberRule.create({
    data: {
      companyId: c,
      documentKind: "document_SURAT_JALAN",
      prefix: "SJ",
      digits: 4,
      effectiveFrom: new Date("2000-01-01"),
      effectiveTo: new Date("2999-01-01"),
      createdById: a,
    },
  });
  await tx.documentNumberRule.create({
    data: {
      companyId: c,
      documentKind: "sales_invoice",
      prefix: "INV",
      digits: 4,
      effectiveFrom: new Date("2000-01-01"),
      effectiveTo: new Date("2999-01-01"),
      createdById: a,
    },
  });
  await tx.systemPolicy.create({
    data: {
      companyId: c,
      code: "OPS-WH-02",
      name: "Stock",
      ownerDomain: "warehouse",
      policyGroup: "stock",
      scope: "company",
      valueType: "object",
      validationSchema: {},
      defaultValueSnapshot: {},
      versions: {
        create: {
          versionNo: 1,
          state: "ACTIVE",
          savedById: a,
          valueSnapshot: { with_expiry: "FEFO", without_expiry: "FIFO" },
        },
      },
    },
  });
  await tx.financePeriod.create({
    data: {
      companyId: c,
      startsOn: new Date("2000-01-01"),
      endsOn: new Date("2999-01-01"),
      state: "OPEN",
    },
  });
  await tx.financePostingProfile.create({
    data: {
      companyId: c,
      effectiveFrom: new Date("2000-01-01"),
      effectiveTo: new Date("2999-01-01"),
      createdById: a,
      mappings: Object.fromEntries(
        [
          "INVENTORY",
          "SALE_COGS",
          "UNBILLED_AR",
          "AR",
          "SALE_REVENUE",
          "SALES_TAX",
          "SALE_FREIGHT_REVENUE",
        ].map((k) => [k, account.id]),
      ),
    },
  });
  const evidence = await tx.transactionEvidence.create({
    data: {
      companyId: c,
      purpose: "SURAT_JALAN",
      objectKey: randomUUID(),
      sha256: randomUUID(),
      actorId: a,
      originalName: "proof.jpg",
      sizeBytes: 10,
    },
  });
  const input = (quantity = "4") => ({
    sales_order_id: order.id,
    lines: [{ sales_order_line_id: order.lines[0]!.id, quantity }],
  });
  const handover = (quantity = "4") => ({
    handover_at: new Date().toISOString(),
    receiver_name: "Receiver",
    evidence_id: evidence.id,
    lines: [{ sales_order_line_id: order.lines[0]!.id, delivered_quantity: quantity }],
  });
  return { tx, c, a, w, p, uom, altUom, lot, order, input, handover };
}
describe("Release 1 Surat Jalan", () => {
  it("persists the operational fields shown by the Surat Jalan form", async () =>
    fixture(async (f) => {
      const note = await createDeliveryNote(
        f.c,
        f.a,
        {
          ...f.input("4"),
          number: "SJ/2026/10/FORM-1",
          document_date: "2026-10-29",
          ship_date: "2026-10-30",
          warehouse_id: f.w.id,
          carrier_name: "Ekspedisi Uji",
          vehicle_number: "DD 1234 AA",
          driver_name: "Driver Uji",
          freight_amount: "125000.50",
        },
        randomUUID(),
      );
      expect(note).toMatchObject({
        number: "SJ/2026/10/FORM-1",
        warehouseId: f.w.id,
        carrierName: "Ekspedisi Uji",
        vehicleNumber: "DD 1234 AA",
        driverName: "Driver Uji",
        freightAmount: new Prisma.Decimal("125000.50"),
      });
      expect(note.documentDate?.toISOString().slice(0, 10)).toBe("2026-10-29");
      expect(note.shipDate?.toISOString().slice(0, 10)).toBe("2026-10-30");
      const updated = await updateDeliveryNoteDraft(
        f.c,
        f.a,
        note.id,
        { ...f.input("3"), number: "SJ/2026/10/FORM-1", warehouse_id: f.w.id, ship_date: "2026-10-31" },
        randomUUID(),
      );
      expect(updated.shipDate?.toISOString().slice(0, 10)).toBe("2026-10-31");
    }));

  it("snapshots form metadata when the document is issued", async () =>
    fixture(async (f) => {
      const note = await createDeliveryNote(
        f.c,
        f.a,
        { ...f.input("2"), document_date: "2026-10-29", ship_date: "2026-10-30", warehouse_id: f.w.id, driver_name: "Driver Snapshot" },
        randomUUID(),
      );
      await issueDeliveryNote(f.c, f.a, note.id, {}, randomUUID());
      const issued = await getDeliveryNote(f.c, note.id, f.tx);
      expect(issued.snapshot).toMatchObject({
        document_date: "2026-10-29",
        ship_date: "2026-10-30",
        warehouse_id: f.w.id,
        driver_name: "Driver Snapshot",
      });
    }));

  it("creates one posted invoice from an issued Surat Jalan and replays idempotently", async () =>
    fixture(async (f) => {
      const service = new OtcPtpService(new AuditService());
      const originalCode = f.p.code;
      const originalName = f.p.name;
      await f.tx.salesOrderLine.update({ where: { id: f.order.lines[0]!.id }, data: { uomId: f.altUom.id } });
      const note = await createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
      await issueDeliveryNote(f.c, f.a, note.id, {}, randomUUID());
      await f.tx.company.update({ where: { id: f.c }, data: { name: "RENAMED AFTER SJ" } });
      await f.tx.product.update({ where: { id: f.p.id }, data: { code: "MUTATED", name: "Mutated product" } });

      const key = randomUUID();
      const invoice = await service.createInvoiceFromDeliveryNote(
        f.c,
        f.a,
        { surat_jalan_id: note.id },
        key,
      );
      expect(invoice).toMatchObject({
        state: "POSTED",
        deliveryNoteId: note.id,
        subtotal: new Prisma.Decimal("40"),
        taxAmount: new Prisma.Decimal("4"),
        total: new Prisma.Decimal("44"),
        outstandingAmount: new Prisma.Decimal("44"),
      });
      expect(
        await f.tx.financeJournal.count({
          where: { companyId: f.c, sourceType: "SALES_INVOICE", sourceId: invoice.id },
        }),
      ).toBe(1);
      expect(await f.tx.ledgerEntry.count({ where: { companyId: f.c, sourceId: invoice.id } })).toBe(2);
      const detail = await new OperationsService(new AuditService()).invoice(f.c, invoice.id, false, f.tx);
      expect((detail.snapshot as { company?: string }).company).toBe("SJ TEST");
      expect((detail.snapshot as { allocations?: { product_code?: string; unit?: string }[] }).allocations).toMatchObject([
        { product_code: originalCode, product: originalName, unit: f.altUom.name },
      ]);
      expect(
        (await service.createInvoiceFromDeliveryNote(f.c, f.a, { surat_jalan_id: note.id }, key)).id,
      ).toBe(invoice.id);
      expect(await f.tx.salesInvoice.count({ where: { companyId: f.c, deliveryNoteId: note.id } })).toBe(1);
      expect(await f.tx.financeJournal.count({ where: { companyId: f.c, sourceType: "SALES_INVOICE", sourceId: invoice.id } })).toBe(1);
      expect(await f.tx.ledgerEntry.count({ where: { companyId: f.c, sourceId: invoice.id } })).toBe(2);
    }));

  it("rolls stock, document, ledger, audit and outbox back when posting configuration fails", async () =>
    fixture(async (f) => {
      const note = await createDeliveryNote(f.c, f.a, f.input(), randomUUID());
      await f.tx.financePostingProfile.updateMany({
        where: { companyId: f.c },
        data: { mappings: {} },
      });
      await expect(
        issueDeliveryNote(f.c, f.a, note.id, {}, randomUUID()),
      ).rejects.toThrow("POSTING_MAPPING_REQUIRED");
      expect((await getDeliveryNote(f.c, note.id, f.tx)).state).toBe("DRAFT");
      expect(
        (
          await f.tx.stockLot.findUniqueOrThrow({ where: { id: f.lot.id } })
        ).quantityOnHand.toString(),
      ).toBe("10");
      expect(await f.tx.inventoryMovement.count({ where: { companyId: f.c } })).toBe(0);
      expect(await f.tx.financeJournal.count({ where: { companyId: f.c } })).toBe(0);
      expect(await f.tx.ledgerEntry.count({ where: { companyId: f.c } })).toBe(0);
      expect(await f.tx.outboxEvent.count({ where: { companyId: f.c } })).toBe(0);
      expect(
        await f.tx.auditEvent.count({ where: { companyId: f.c, action: "delivery_note.issued" } }),
      ).toBe(0);
    }));
  it("revalidates cumulative quantities at issue after another draft issues", async () =>
    fixture(async (f) => {
      const first = await createDeliveryNote(f.c, f.a, f.input("7"), randomUUID());
      const second = await createDeliveryNote(f.c, f.a, f.input("7"), randomUUID());
      await issueDeliveryNote(f.c, f.a, first.id, {}, randomUUID());
      await expect(
        issueDeliveryNote(f.c, f.a, second.id, {}, randomUUID()),
      ).rejects.toThrow("DELIVERY_NOTE_QTY_EXCEEDED");
      expect(await f.tx.financeJournal.count({ where: { companyId: f.c } })).toBe(1);
      expect((await getDeliveryNote(f.c, second.id, f.tx)).state).toBe("DRAFT");
    }));
  it("keeps drafts free of stock and ledger effects, updates, issues once and preserves snapshots", async () =>
    fixture(async (f) => {
      const note = await createDeliveryNote(f.c, f.a, f.input(), randomUUID());
      expect(note.state).toBe("DRAFT");
      expect(await f.tx.inventoryMovement.count({ where: { companyId: f.c } })).toBe(0);
      await updateDeliveryNoteDraft(f.c, f.a, note.id, f.input("5"), randomUUID());
      const key = randomUUID();
      const payload = {};
      const issued = await issueDeliveryNote(f.c, f.a, note.id, payload, key);
      expect(issued.state).toBe("ISSUED");
      expect(
        (
          await f.tx.stockLot.findUniqueOrThrow({ where: { id: f.lot.id } })
        ).quantityOnHand.toString(),
      ).toBe("5");
      expect(
        await f.tx.financeJournal.count({
          where: { companyId: f.c, sourceType: "DELIVERY_NOTE", sourceId: note.id },
        }),
      ).toBe(1);
      expect((await issueDeliveryNote(f.c, f.a, note.id, payload, key)).id).toBe(note.id);
      expect(await f.tx.inventoryMovement.count({ where: { companyId: f.c } })).toBe(1);
      expect((await getDeliveryNote(f.c, note.id, f.tx)).snapshot).toMatchObject({
        payment: { term_code: "N30", top_days: 30 },
      });
      await expect(
        updateDeliveryNoteDraft(f.c, f.a, note.id, f.input(), randomUUID()),
      ).rejects.toThrow("DELIVERY_NOTE_IMMUTABLE");
    }));
  it("rejects cumulative excess, invalid handover and insufficient eligible stock without posting", async () =>
    fixture(async (f) => {
      await expect(createDeliveryNote(f.c, f.a, f.input("11"), randomUUID())).rejects.toThrow(
        "DELIVERY_NOTE_QTY_EXCEEDED",
      );
      expect(() => createDeliveryNote(f.c, f.a, f.input("0"), randomUUID())).toThrow();
      const note = await createDeliveryNote(f.c, f.a, f.input("7"), randomUUID());
      expect(() => issueDeliveryNote(f.c, f.a, note.id, f.handover("7"), randomUUID())).toThrow();
      await f.tx.stockLot.update({ where: { id: f.lot.id }, data: { qualityState: "QUARANTINE" } });
      await expect(
        issueDeliveryNote(f.c, f.a, note.id, {}, randomUUID()),
      ).rejects.toThrow("STOCK_INSUFFICIENT");
      expect(await f.tx.financeJournal.count({ where: { companyId: f.c } })).toBe(0);
      await f.tx.stockLot.update({ where: { id: f.lot.id }, data: { qualityState: "AVAILABLE" } });
      await issueDeliveryNote(f.c, f.a, note.id, {}, randomUUID());
      await expect(createDeliveryNote(f.c, f.a, f.input("4"), randomUUID())).rejects.toThrow(
        "DELIVERY_NOTE_QTY_EXCEEDED",
      );
    }));
  it("rejects closed periods and cross company reads", async () =>
    fixture(async (f) => {
      const note = await createDeliveryNote(f.c, f.a, f.input(), randomUUID());
      await f.tx.financePeriod.updateMany({ where: { companyId: f.c }, data: { state: "CLOSED" } });
      await expect(
        issueDeliveryNote(f.c, f.a, note.id, {}, randomUUID()),
      ).rejects.toThrow();
      expect(
        (
          await f.tx.stockLot.findUniqueOrThrow({ where: { id: f.lot.id } })
        ).quantityOnHand.toString(),
      ).toBe("10");
      await expect(getDeliveryNote(randomUUID(), note.id, f.tx)).rejects.toThrow();
    }));
});
