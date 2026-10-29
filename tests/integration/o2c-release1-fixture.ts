/** Shared rollback fixture for Release 1 O2C read-model tests (copied from o2c-delivery-note.test.ts). */
import { randomUUID } from "node:crypto";
import { vi } from "vitest";
import { prisma, type Prisma as PrismaTypes } from "@evflow/database";

const realTransaction = prisma.$transaction.bind(prisma);
const rollback = new Error("rollback SJ fixture");
export async function o2cFixture(run: (f: Awaited<ReturnType<typeof o2cSetup>>) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database only");
  await realTransaction(
    async (tx) => {
      const f = await o2cSetup(tx);
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
export async function o2cSetup(tx: PrismaTypes.TransactionClient) {
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
