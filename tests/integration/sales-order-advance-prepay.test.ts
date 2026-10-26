import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@evflow/database";
import {
  availablePrepayFunds,
  bindOrderAdvancesToBatch,
} from "../../packages/backend/src/sales/prepay-funds";

const rollback = new Error("PREPAY_TEST_ROLLBACK");
async function fixture(
  run: (
    tx: Prisma.TransactionClient,
    c: string,
    orderId: string,
    first: string,
    second: string,
    receipt: (amount: string, batch?: string) => Promise<string>,
  ) => Promise<void>,
) {
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname)
  )
    throw new Error("Local database only");
  await prisma
    .$transaction(async (tx) => {
      const c = (await tx.company.create({ data: { name: "PREPAY TEST ONLY" } })).id;
      const a = (
        await tx.user.create({
          data: {
            email: `${randomUUID()}@test.invalid`,
            displayName: "Tester",
            passwordHash: "disabled",
          },
        })
      ).id;
      const customer = await tx.customer.create({
        data: {
          companyId: c,
          code: randomUUID(),
          name: "Test",
          normalizedName: randomUUID(),
          state: "ACTIVE",
          createdById: a,
          updatedById: a,
        },
      });
      const order = await tx.salesOrder.create({
        data: {
          companyId: c,
          customerId: customer.id,
          number: randomUUID(),
          createdById: a,
          state: "OPEN",
        },
      });
      const first = await tx.fulfillmentBatch.create({
        data: { companyId: c, salesOrderId: order.id, number: randomUUID() },
      });
      const second = await tx.fulfillmentBatch.create({
        data: { companyId: c, salesOrderId: order.id, number: randomUUID() },
      });
      const receipt = async (amount: string, batch?: string) =>
        (
          await tx.customerReceipt.create({
            data: {
              companyId: c,
              customerId: customer.id,
              salesOrderId: order.id,
              fulfillmentBatchId: batch,
              amount,
              unallocatedAmount: amount,
              currency: "IDR",
              receivedAt: new Date(),
              idempotencyKey: randomUUID(),
              createdById: a,
            },
          })
        ).id;
      await run(tx, c, order.id, first.id, second.id, receipt);
      throw rollback;
    })
    .catch((e) => {
      if (e !== rollback) throw e;
    });
}
describe("SO advance funds for prepay", () => {
  it("includes verified unbound SO funds and legacy batch receipts exactly once", () =>
    fixture(async (tx, c, orderId, first, second, receipt) => {
      await receipt("40", first);
      await receipt("60");
      await receipt("99", second);
      expect(
        (
          await availablePrepayFunds(tx, c, { id: first, salesOrderId: orderId, currency: "IDR" })
        ).toString(),
      ).toBe("100");
      expect(
        (
          await availablePrepayFunds(tx, randomUUID(), {
            id: first,
            salesOrderId: orderId,
            currency: "IDR",
          })
        ).toString(),
      ).toBe("0");
      expect(
        (
          await availablePrepayFunds(tx, c, { id: first, salesOrderId: orderId, currency: "USD" })
        ).toString(),
      ).toBe("0");
    }));
  it("binds required SO receipts and prevents reuse by another batch", () =>
    fixture(async (tx, c, orderId, first, second, receipt) => {
      const id = await receipt("100");
      await bindOrderAdvancesToBatch(
        tx,
        c,
        { id: first, salesOrderId: orderId, currency: "IDR" },
        new Prisma.Decimal("100"),
      );
      expect(
        (await tx.customerReceipt.findUniqueOrThrow({ where: { id } })).fulfillmentBatchId,
      ).toBe(first);
      expect(
        (
          await availablePrepayFunds(tx, c, { id: second, salesOrderId: orderId, currency: "IDR" })
        ).toString(),
      ).toBe("0");
      await expect(
        bindOrderAdvancesToBatch(
          tx,
          c,
          { id: second, salesOrderId: orderId, currency: "IDR" },
          new Prisma.Decimal("1"),
        ),
      ).rejects.toThrow("PREPAYMENT_REQUIRED");
    }));
  it("does not bind extra receipts when batch funds already suffice", () =>
    fixture(async (tx, c, orderId, first, _second, receipt) => {
      await receipt("100", first);
      const extra = await receipt("50");
      await bindOrderAdvancesToBatch(
        tx,
        c,
        { id: first, salesOrderId: orderId, currency: "IDR" },
        new Prisma.Decimal("100"),
      );
      expect(
        (await tx.customerReceipt.findUniqueOrThrow({ where: { id: extra } })).fulfillmentBatchId,
      ).toBeNull();
    }));
  it("does not treat a pending advance as a posted receipt", () =>
    fixture(async (tx, c, orderId, first) => {
      expect(
        (
          await availablePrepayFunds(tx, c, { id: first, salesOrderId: orderId, currency: "IDR" })
        ).toString(),
      ).toBe("0");
      await expect(
        bindOrderAdvancesToBatch(
          tx,
          c,
          { id: first, salesOrderId: orderId, currency: "IDR" },
          new Prisma.Decimal("100"),
        ),
      ).rejects.toThrow("PREPAYMENT_REQUIRED");
    }));
});
