import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { o2cSetup } from "./o2c-release1-fixture";
import {
  createDeliveryNote,
  issueDeliveryNote,
} from "../../packages/backend/src/sales/delivery-note";
import { createAndPostInvoice } from "../../packages/backend/src/finance/invoice";
import { receiveInvoicePayment } from "../../packages/backend/src/finance/invoice-payment";

it("serializes separate database transactions for one SJ and competing payments", async () => {
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname)
  )
    throw new Error("Local development database only");
  // Separate connections must see committed fixtures to exercise real row/advisory locks.
  // Posted audit/journal records are intentionally retained under a distinct test company.
  const f = await prisma.$transaction(o2cSetup, { timeout: 30000 });
  await prisma.company.update({
    where: { id: f.c },
    data: { name: `INVOICE CONCURRENCY TEST ${f.c}` },
  });
  const note = await createDeliveryNote(f.c, f.a, f.input("4"), randomUUID());
  await issueDeliveryNote(f.c, f.a, note.id, {}, randomUUID());
  const invoices = await Promise.all(
    [1, 2].map(() => createAndPostInvoice(f.c, f.a, { surat_jalan_id: note.id }, randomUUID())),
  );
  expect(invoices[0]!.id).toBe(invoices[1]!.id);
  const id = invoices[0]!.id;
  expect(
    await prisma.financeJournal.count({
      where: { companyId: f.c, sourceType: "SALES_INVOICE", sourceId: id },
    }),
  ).toBe(1);
  const account = await prisma.financeAccount.findFirstOrThrow({ where: { companyId: f.c } });
  const bank = await prisma.financeBankAccount.create({
    data: {
      companyId: f.c,
      code: "TEST",
      name: "Test bank",
      bankName: "Test",
      lastFour: "0000",
      currency: "IDR",
      accountId: account.id,
    },
  });
  const evidence = await prisma.transactionEvidence.create({
    data: {
      companyId: f.c,
      actorId: f.a,
      purpose: "PAYMENT",
      objectKey: randomUUID(),
      sha256: randomUUID(),
      originalName: "test.png",
      sizeBytes: 10,
    },
  });
  await prisma.documentNumberRule.create({
    data: {
      companyId: f.c,
      documentKind: "customer_receipt",
      prefix: "TEST-RC",
      digits: 4,
      effectiveFrom: new Date("2000-01-01"),
      effectiveTo: new Date("2999-01-01"),
      createdById: f.a,
    },
  });
  const results = await Promise.allSettled(
    [1, 2].map((n) =>
      receiveInvoicePayment(
        f.c,
        f.a,
        id,
        {
          received_date: "2026-10-30",
          bank_account_id: bank.id,
          evidence_id: evidence.id,
          bank_reference: `TEST-${n}`,
          amount: "30",
        },
        randomUUID(),
      ),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(
    (await prisma.salesInvoice.findUniqueOrThrow({ where: { id } })).outstandingAmount.toString(),
  ).toBe("14");
  expect(await prisma.customerReceipt.count({ where: { companyId: f.c } })).toBe(1);
});
