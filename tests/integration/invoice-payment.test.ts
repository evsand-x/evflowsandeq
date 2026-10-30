import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { o2cFixture } from "./o2c-release1-fixture";
import * as payments from "../../packages/backend/src/finance/invoice-payment";

async function setup(f: Parameters<Parameters<typeof o2cFixture>[0]>[0]) {
  const { tx, c, a, order } = f;
  const invoice = await tx.salesInvoice.create({
    data: {
      companyId: c,
      customerId: order.customerId,
      salesOrderId: order.id,
      number: randomUUID(),
      state: "POSTED",
      subtotal: "100",
      taxAmount: "10",
      total: "110",
      outstandingAmount: "110",
    },
  });
  const account = await tx.financeAccount.findFirstOrThrow({ where: { companyId: c } });
  const bank = await tx.financeBankAccount.create({
    data: {
      companyId: c,
      code: "BANK",
      name: "Bank",
      bankName: "Test",
      lastFour: "0000",
      currency: "IDR",
      accountId: account.id,
    },
  });
  const evidence = await tx.transactionEvidence.create({
    data: {
      companyId: c,
      purpose: "PAYMENT",
      objectKey: randomUUID(),
      sha256: randomUUID(),
      actorId: a,
      originalName: "transfer.jpg",
      sizeBytes: 10,
    },
  });
  await tx.documentNumberRule.create({
    data: {
      companyId: c,
      documentKind: "customer_receipt",
      prefix: "RC",
      digits: 4,
      effectiveFrom: new Date("2000-01-01"),
      effectiveTo: new Date("2999-01-01"),
      createdById: a,
    },
  });
  const input = {
    received_date: "2026-10-30",
    bank_account_id: bank.id,
    amount: "40",
    bank_reference: randomUUID(),
    evidence_id: evidence.id,
  };
  return { invoice, bank, evidence, input, account };
}
describe("atomic invoice payment", () => {
  it("allocates cash atomically and replays without an advance tax or duplicate journal", async () =>
    o2cFixture(async (f) => {
      const { invoice, input } = await setup(f);
      const key = randomUUID();
      const result = await payments.receiveInvoicePayment(f.c, f.a, invoice.id, input, key);
      expect(result.outstanding_amount).toBe("70");
      expect(
        (await payments.receiveInvoicePayment(f.c, f.a, invoice.id, input, key)).receipt.id,
      ).toBe(result.receipt.id);
      expect(await f.tx.customerReceiptAllocation.count({ where: { invoiceId: invoice.id } })).toBe(
        1,
      );
      expect(await f.tx.advanceTax.count({ where: { receiptId: result.receipt.id } })).toBe(0);
      expect(await f.tx.financeJournal.count({ where: { sourceId: result.receipt.id } })).toBe(1);
      await expect(
        payments.receiveInvoicePayment(f.c, f.a, invoice.id, { ...input, amount: "41" }, key),
      ).rejects.toThrow("IDEMPOTENCY_PAYLOAD_MISMATCH");
      await expect(
        payments.receiveInvoicePayment(f.c, f.a, invoice.id, input, randomUUID()),
      ).rejects.toThrow("BANK_REFERENCE_DUPLICATE");
    }));
  it("keeps required proof pending then settles exactly once from the snapshot", async () =>
    o2cFixture(async (f) => {
      const { invoice, input, account } = await setup(f);
      const type = await f.tx.deductionType.create({
        data: {
          companyId: f.c,
          name: "Withheld",
          settleAccountId: account.id,
          proofType: "BUKTI_POTONG",
          proofRequired: true,
        },
      });
      const result = await payments.receiveInvoicePayment(
        f.c,
        f.a,
        invoice.id,
        {
          ...input,
          amount: "100",
          deductions: [
            { source_type: "DEDUCTION_TYPE", source_id: type.id, mode: "PERCENT", value: "10" },
          ],
        },
        randomUUID(),
      );
      expect(result.outstanding_amount).toBe("10");
      expect(result.deductions[0]!.state).toBe("PENDING_PROOF");
      const evidence = await f.tx.transactionEvidence.create({
        data: {
          companyId: f.c,
          purpose: "TAX",
          objectKey: randomUUID(),
          sha256: randomUUID(),
          actorId: f.a,
          originalName: "tax.pdf",
          sizeBytes: 10,
        },
      });
      await f.tx.deductionType.update({ where: { id: type.id }, data: { active: false } });
      const proof = {
        evidence_id: evidence.id,
        proof_number: "PROOF-1",
        proof_date: "2026-10-30",
        settlement_date: "2026-10-30",
      };
      await payments.completeInvoicePaymentDeductionProof(
        f.c,
        f.a,
        result.deductions[0]!.id,
        proof,
        randomUUID(),
      );
      expect(
        (
          await f.tx.salesInvoice.findUniqueOrThrow({ where: { id: invoice.id } })
        ).outstandingAmount.toString(),
      ).toBe("0");
      await expect(
        payments.completeInvoicePaymentDeductionProof(
          f.c,
          f.a,
          result.deductions[0]!.id,
          proof,
          randomUUID(),
        ),
      ).rejects.toThrow("DEDUCTION_ALREADY_SETTLED");
      expect(
        await f.tx.outboxEvent.count({
          where: {
            companyId: f.c,
            eventType: "invoice_payment.deduction_settled",
            aggregateId: result.deductions[0]!.id,
          },
        }),
      ).toBe(1);
    }));
  it("rolls back overpayments and rejects foreign bank, invalid evidence, and closed periods", async () =>
    o2cFixture(async (f) => {
      const { invoice, input } = await setup(f);
      for (const [change, error] of [
        [{ amount: "111" }, "PAYMENT_EXCEEDS_OUTSTANDING"],
        [{ bank_account_id: randomUUID() }, "BANK_ACCOUNT_REQUIRED"],
        [{ evidence_id: randomUUID() }, "PAYMENT_EVIDENCE_REQUIRED"],
      ] as const) {
        await expect(
          payments.receiveInvoicePayment(
            f.c,
            f.a,
            invoice.id,
            { ...input, ...change },
            randomUUID(),
          ),
        ).rejects.toThrow(error);
      }
      await expect(
        payments.receiveInvoicePayment(randomUUID(), f.a, invoice.id, input, randomUUID()),
      ).rejects.toThrow();
      await f.tx.financePeriod.updateMany({ where: { companyId: f.c }, data: { state: "CLOSED" } });
      await expect(
        payments.receiveInvoicePayment(f.c, f.a, invoice.id, input, randomUUID()),
      ).rejects.toThrow();
      expect(await f.tx.customerReceipt.count({ where: { companyId: f.c } })).toBe(0);
      expect(
        (
          await f.tx.salesInvoice.findUniqueOrThrow({ where: { id: invoice.id } })
        ).outstandingAmount.toString(),
      ).toBe("110");
    }));
});

it("settles a full payment with an evidenced fixed deduction and balances the cash journal", async () =>
  o2cFixture(async (f) => {
    const { invoice, input, account } = await setup(f);
    const type = await f.tx.deductionType.create({
      data: {
        companyId: f.c,
        name: "Discount",
        settleAccountId: account.id,
        proofType: "NONE",
        proofRequired: false,
      },
    });
    const result = await payments.receiveInvoicePayment(
      f.c,
      f.a,
      invoice.id,
      {
        ...input,
        amount: "100",
        deductions: [
          { source_type: "DEDUCTION_TYPE", source_id: type.id, mode: "AMOUNT", value: "10" },
        ],
      },
      randomUUID(),
    );
    expect(result.outstanding_amount).toBe("0");
    expect(result.deductions[0]!.state).toBe("SETTLED");
    const journal = await f.tx.financeJournal.findFirstOrThrow({
      where: { sourceId: result.receipt.id },
      include: { lines: true },
    });
    expect(
      journal.lines
        .reduce((sum, l) => sum.add(l.debit).sub(l.credit), invoice.total!.mul(0))
        .toString(),
    ).toBe("0");
    expect(journal.lines.find((l) => l.ledgerKind === "CASH_RECEIPT")!.debit.toString()).toBe(
      "100",
    );
    expect(journal.lines.find((l) => l.ledgerKind === "AR")!.credit.toString()).toBe("110");
    expect(journal.businessDate.toISOString().slice(0, 10)).toBe("2026-10-30");
    const form = await payments.invoicePaymentForm(f.c, invoice.id);
    expect(form.banks.map((b) => b.id)).toContain(input.bank_account_id);
    expect(form.deductions).toHaveLength(1);
    expect(form.accounts).toContainEqual({
      id: account.id,
      code: account.code,
      name: account.name,
    });
    await expect(
      payments.receiveInvoicePayment(
        f.c,
        f.a,
        invoice.id,
        { ...input, bank_reference: randomUUID() },
        randomUUID(),
      ),
    ).rejects.toThrow("PAYMENT_EXCEEDS_OUTSTANDING");
  }));

it("enforces payment grants independently of invoice grants at the controller guard", async () => {
  const { Reflector } = createRequire(
    new URL("../../packages/backend/package.json", import.meta.url),
  )("@nestjs/core");
  const { PermissionGuard } = await import("../../packages/backend/src/identity/permission.guard");
  const { InvoicePaymentController } = await import(
    "../../packages/backend/src/finance/invoice-payment.controller"
  );
  const guard = new PermissionGuard(new Reflector());
  const c = randomUUID();
  const context = (method: "form" | "receive" | "proof", codes: string[]) =>
    ({
      getHandler: () => InvoicePaymentController.prototype[method],
      getClass: () => InvoicePaymentController,
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            company_id: c,
            roles: [],
            permissions: codes.map((code) => ({ code, scope_type: "company", scope_id: c })),
          },
        }),
      }),
    }) as unknown as ExecutionContext;
  expect(() => guard.canActivate(context("form", ["sales_invoice.read"]))).toThrow();
  expect(() => guard.canActivate(context("form", ["customer_receipt.read"]))).toThrow();
  expect(() => guard.canActivate(context("receive", ["customer_receipt.post"]))).toThrow();
  expect(() => guard.canActivate(context("receive", ["sales_invoice.post"]))).toThrow();
  expect(
    guard.canActivate(context("form", ["customer_receipt.read", "sales_invoice.view_price"])),
  ).toBe(true);
  expect(
    guard.canActivate(context("receive", ["customer_receipt.post", "sales_invoice.view_price"])),
  ).toBe(true);
  expect(
    guard.canActivate(context("proof", ["customer_receipt.post", "sales_invoice.view_price"])),
  ).toBe(true);
});

it("blocks legacy reversal for direct invoice receipt before request or posting", async () =>
  o2cFixture(async (f) => {
    const { requestReversal, postReversal } = await import(
      "../../packages/backend/src/finance/source-reversal"
    );
    const { invoice, input } = await setup(f);
    const result = await payments.receiveInvoicePayment(f.c, f.a, invoice.id, input, randomUUID());
    const journal = await f.tx.financeJournal.findFirstOrThrow({
      where: { sourceId: result.receipt.id },
    });
    const reversal = {
      journal_id: journal.id,
      occurred_at: new Date().toISOString(),
      evidence_id: input.evidence_id,
      reason: "Correction",
    };
    await expect(requestReversal(f.c, f.a, reversal, randomUUID())).rejects.toThrow(
      "USE_SOURCE_DOMAIN_CORRECTION",
    );
    const request = await f.tx.o2cControlEvent.create({
      data: {
        companyId: f.c,
        actorId: f.a,
        sourceType: "SOURCE_REVERSAL",
        sourceId: journal.id,
        kind: "REQUEST",
        snapshot: { input: reversal },
      },
    });
    await expect(postReversal(f.c, f.a, request.id, randomUUID())).rejects.toThrow(
      "USE_SOURCE_DOMAIN_CORRECTION",
    );
  }));

it("prevents a legacy receipt from reusing an invoice payment bank reference", async () =>
  o2cFixture(async (f) => {
    const { postCustomerReceiptTx } = await import(
      "../../packages/backend/src/finance/customer-receipt"
    );
    const { invoice, input } = await setup(f);
    await payments.receiveInvoicePayment(f.c, f.a, invoice.id, input, randomUUID());
    await expect(
      postCustomerReceiptTx(f.tx, f.c, f.a, {
        customerId: invoice.customerId,
        amount: "10",
        receivedAt: new Date(),
        bankAccountId: input.bank_account_id,
        bankReference: input.bank_reference,
        evidenceId: input.evidence_id,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow("BANK_REFERENCE_DUPLICATE");
  }));

it("shows unclaimed proof separately when later cash clears the invoice", async () =>
  o2cFixture(async (f) => {
    const { invoice, input, account } = await setup(f);
    const type = await f.tx.deductionType.create({
      data: {
        companyId: f.c,
        name: "Pending",
        settleAccountId: account.id,
        proofType: "BUKTI_POTONG",
        proofRequired: true,
      },
    });
    await payments.receiveInvoicePayment(
      f.c,
      f.a,
      invoice.id,
      {
        ...input,
        amount: "100",
        deductions: [
          { source_type: "DEDUCTION_TYPE", source_id: type.id, mode: "AMOUNT", value: "10" },
        ],
      },
      randomUUID(),
    );
    await payments.receiveInvoicePayment(
      f.c,
      f.a,
      invoice.id,
      { ...input, amount: "10", bank_reference: randomUUID() },
      randomUUID(),
    );
    const form = await payments.invoicePaymentForm(f.c, invoice.id);
    expect(form.pending_proof_amount).toBe("10");
    expect(form.settleable_pending_amount).toBe("0");
    expect(form.deductions[0]!.display_state).toBe("NO_OUTSTANDING");
  }));

it("uses active sales deduction tax and stores its account and rounding snapshot", async () =>
  o2cFixture(async (f) => {
    const { invoice, input, account } = await setup(f);
    const tax = await f.tx.operationalTax.create({
      data: {
        companyId: f.c,
        name: "Withholding",
        kind: "PPH",
        effect: "DEDUCT",
        usage: "SALES",
        accountId: account.id,
        percentage: "2.5",
        decimalPlaces: 2,
        rounding: "HALF_UP",
        effectiveFrom: new Date("2026-01-01"),
      },
    });
    const proof = await f.tx.transactionEvidence.create({
      data: {
        companyId: f.c,
        purpose: "TAX",
        objectKey: randomUUID(),
        sha256: randomUUID(),
        actorId: f.a,
        originalName: "proof.pdf",
        sizeBytes: 10,
      },
    });
    const result = await payments.receiveInvoicePayment(
      f.c,
      f.a,
      invoice.id,
      {
        ...input,
        amount: "107.5",
        deductions: [
          {
            source_type: "TAX",
            source_id: tax.id,
            mode: "PERCENT",
            value: "2.5",
            evidence_id: proof.id,
            proof_number: "TX-1",
            proof_date: "2026-10-30",
          },
        ],
      },
      randomUUID(),
    );
    expect(result.outstanding_amount).toBe("0");
    expect(result.deductions[0]!.amount.toString()).toBe("2.5");
    expect(result.deductions[0]!.accountId).toBe(account.id);
    expect(result.deductions[0]!.snapshot).toMatchObject({
      master: { version: 1, rounding: "HALF_UP", percentage: "2.5" },
    });
  }));

it("provisions editable receipt numbering for existing companies without overwriting their rule", async () =>
  o2cFixture(async (f) => {
    const { provisionCompanyDefaults } = await import(
      "../../packages/backend/src/administration/company-defaults"
    );
    const { previewDocumentNumber } = await import(
      "../../packages/backend/src/common/document-number"
    );
    await provisionCompanyDefaults(f.tx, f.c, f.a, new Date("2026-10-30"));
    expect(
      await previewDocumentNumber(f.tx, f.c, "customer_receipt", new Date("2026-10-30")),
    ).toMatch(/^RC/);
    await f.tx.documentNumberRule.updateMany({
      where: { companyId: f.c, documentKind: "customer_receipt" },
      data: { prefix: "CUSTOM" },
    });
    await provisionCompanyDefaults(f.tx, f.c, f.a, new Date("2026-10-30"));
    expect(
      await previewDocumentNumber(f.tx, f.c, "customer_receipt", new Date("2026-10-30")),
    ).toMatch(/^CUSTOM/);
  }));

it("scopes payment evidence to its invoice rather than exposing unrelated tax attachments", async () =>
  o2cFixture(async (f) => {
    const { InvoicePaymentController } = await import(
      "../../packages/backend/src/finance/invoice-payment.controller"
    );
    const { invoice, input } = await setup(f);
    const controller = new InvoicePaymentController({
      evidence: async () => ({ id: input.evidence_id }),
      upload: async () => ({}),
    } as never);
    const req = { auth: { company_id: f.c, user_id: f.a } } as never;
    await expect(controller.evidence(req, invoice.id, input.evidence_id)).rejects.toThrow();
    await payments.receiveInvoicePayment(f.c, f.a, invoice.id, input, randomUUID());
    expect(await controller.evidence(req, invoice.id, input.evidence_id)).toEqual({
      data: { id: input.evidence_id },
    });
    await expect(
      controller.upload(req, randomUUID(), { purpose: "TAX", name: "proof.png", base64: "AAAA" }),
    ).rejects.toThrow();
  }));

it("payment form preserves customer snapshot and shows dates, total, cash and settlement", async () =>
  o2cFixture(async (f) => {
    const { invoice, input, account } = await setup(f);
    await f.tx.salesInvoice.update({
      where: { id: invoice.id },
      data: {
        invoiceDate: new Date("2026-10-29"),
        dueDate: new Date("2026-11-28"),
        issuedSnapshot: {
          customer: { id: invoice.customerId, code: "CUS-OLD", name: "Customer at issue" },
        },
      },
    });
    await f.tx.customer.update({
      where: { id: invoice.customerId },
      data: { name: "Renamed customer" },
    });
    const type = await f.tx.deductionType.create({
      data: {
        companyId: f.c,
        name: "Settlement",
        settleAccountId: account.id,
        proofType: "NONE",
        proofRequired: false,
      },
    });
    await payments.receiveInvoicePayment(
      f.c,
      f.a,
      invoice.id,
      {
        ...input,
        deductions: [
          { source_type: "DEDUCTION_TYPE", source_id: type.id, mode: "AMOUNT", value: "10" },
        ],
      },
      randomUUID(),
    );
    const form = await payments.invoicePaymentForm(f.c, invoice.id);
    expect(form.invoice.customer).toEqual({
      id: invoice.customerId,
      code: "CUS-OLD",
      name: "Customer at issue",
    });
    expect(form.invoice.invoiceDate.toISOString().slice(0, 10)).toBe("2026-10-29");
    expect(form.invoice.dueDate?.toISOString().slice(0, 10)).toBe("2026-11-28");
    expect(form.invoice.total.toString()).toBe("110");
    expect(form.invoice.cashPaidAmount).toBe("40");
    expect(form.invoice.settledAmount).toBe("50");
    expect(form.invoice.outstandingAmount.toString()).toBe("60");
    await f.tx.company.update({ where: { id: f.c }, data: { timezone: "America/New_York" } });
    await f.tx.salesInvoice.update({
      where: { id: invoice.id },
      data: { invoiceDate: null, postedAt: new Date("2026-10-29T02:00:00Z") },
    });
    expect(
      (await payments.invoicePaymentForm(f.c, invoice.id)).invoice.invoiceDate
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-10-28");
  }));

it("payment form excludes reversed legacy allocations from cash paid", async () =>
  o2cFixture(async (f) => {
    const { invoice, input } = await setup(f);
    const receipt = await f.tx.customerReceipt.create({
      data: {
        companyId: f.c,
        customerId: invoice.customerId,
        receivedAt: new Date(),
        amount: "10",
        unallocatedAmount: "10",
        idempotencyKey: randomUUID(),
        createdById: f.a,
        bankAccountId: input.bank_account_id,
        evidenceId: input.evidence_id,
      },
    });
    const allocation = await f.tx.customerReceiptAllocation.create({
      data: { companyId: f.c, invoiceId: invoice.id, receiptId: receipt.id, amount: "10" },
    });
    const period = await f.tx.financePeriod.findFirstOrThrow({ where: { companyId: f.c } });
    const profile = await f.tx.financePostingProfile.findFirstOrThrow({
      where: { companyId: f.c },
    });
    const journal = await f.tx.financeJournal.create({
      data: {
        companyId: f.c,
        sourceType: "CUSTOMER_RECEIPT_ALLOCATION",
        sourceId: allocation.id,
        businessDate: new Date("2026-10-30"),
        periodId: period.id,
        profileId: profile.id,
        currency: "IDR",
        actorId: f.a,
      },
    });
    await f.tx.o2cControlEvent.create({
      data: {
        companyId: f.c,
        actorId: f.a,
        sourceType: "JOURNAL",
        sourceId: journal.id,
        kind: "REVERSED",
        snapshot: {},
      },
    });
    expect((await payments.invoicePaymentForm(f.c, invoice.id)).invoice.cashPaidAmount).toBe("0");
  }));

it("configuration errors preserve their codes and link to the existing Setting routes", async () => {
  const { configurationError } = await import("../../packages/backend/src/finance/invoice-errors");
  const { ConflictException } = createRequire(
    new URL("../../packages/backend/package.json", import.meta.url),
  )("@nestjs/common");
  for (const [code, href] of [
    ["BANK_ACCOUNT_REQUIRED", "/setting/account-mapping"],
    ["DEDUCTION_ACCOUNT_INVALID", "/setting/account-mapping"],
    ["POSTING_MAPPING_REQUIRED:AR", "/setting/account-mapping"],
    ["POSTING_PROFILE_REQUIRED_OR_CONFLICTING", "/setting/account-mapping"],
    ["NUMBERING_RULE_REQUIRED_OR_CONFLICTING:customer_receipt", "/setting/numbering"],
  ]) {
    try {
      configurationError(new ConflictException(code));
      throw new Error("Expected failure");
    } catch (error) {
      expect((error as InstanceType<typeof ConflictException>).getResponse()).toMatchObject({
        message: code,
        settings_href: href,
      });
    }
  }
  const unrelated = new ConflictException("PAYMENT_EXCEEDS_OUTSTANDING");
  expect(() => configurationError(unrelated)).toThrow(unrelated);
});
