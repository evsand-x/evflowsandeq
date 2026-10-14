import { ConflictException } from "@nestjs/common";
import { Prisma } from "@evflow/database";

type Tx = Prisma.TransactionClient;
const d = (v: Prisma.Decimal | string | number) => new Prisma.Decimal(v);
export async function lockFinance(tx: Tx, c: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c + ":finance"}, 0))::text`;
}
export async function financeDate(tx: Tx, c: string, date = new Date()) {
  const company = await tx.company.findUniqueOrThrow({ where: { id: c } });
  return new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date),
  );
}

/** Operational subledger and mapped GL commit together; missing configuration rolls back the source. */
export async function postLedger(
  tx: Tx,
  actor: string,
  input: { data: Prisma.LedgerEntryCreateManyInput[]; businessDate?: Date; accountIds?: string[] },
) {
  const first = input.data[0];
  if (!first) throw new ConflictException("JOURNAL_LINES_REQUIRED");
  const c = first.companyId;
  await lockFinance(tx, c);
  if (
    input.data.some(
      (l) =>
        l.companyId !== c || l.sourceId !== first.sourceId || l.sourceType !== first.sourceType,
    )
  )
    throw new ConflictException("JOURNAL_SOURCE_MISMATCH");
  const company = await tx.company.findUniqueOrThrow({ where: { id: c } });
  const currency = first.currency ?? company.baseCurrency;
  if (input.data.some((l) => (l.currency ?? company.baseCurrency) !== currency))
    throw new ConflictException("JOURNAL_CURRENCY_MISMATCH");
  let at = input.businessDate ?? new Date();
  if (first.sourceType === "DELIVERY_RECEIPT") {
    const source = await tx.deliveryReceipt.findFirst({
      where: { id: first.sourceId, companyId: c },
    });
    if (source) at = source.acceptedAt;
  }
  if (first.sourceType === "CUSTOMER_RECEIPT") {
    const source = await tx.customerReceipt.findFirst({
      where: { id: first.sourceId, companyId: c },
    });
    if (source) at = source.receivedAt;
  }
  if (first.sourceType === "ADVANCE_TAX") {
    const advance = await tx.advanceTax.findFirstOrThrow({
      where: { id: first.sourceId, companyId: c },
    });
    at = (await tx.customerReceipt.findUniqueOrThrow({ where: { id: advance.receiptId } }))
      .receivedAt;
  }
  const businessDate = await financeDate(tx, c, at);
  const periods = await tx.financePeriod.findMany({
    where: { companyId: c, startsOn: { lte: businessDate }, endsOn: { gte: businessDate } },
  });
  if (periods.length !== 1 || periods[0]!.state !== "OPEN")
    throw new ConflictException("FINANCE_PERIOD_NOT_OPEN");
  const profiles = await tx.financePostingProfile.findMany({
    where: {
      companyId: c,
      effectiveFrom: { lte: businessDate },
      effectiveTo: { gt: businessDate },
    },
  });
  if (profiles.length !== 1) throw new ConflictException("POSTING_PROFILE_REQUIRED_OR_CONFLICTING");
  const profile = profiles[0]!;
  const mapping = profile.mappings as Record<string, string>;
  let bankAccount: string | undefined;
  if (["CUSTOMER_RECEIPT", "CUSTOMER_REFUND"].includes(first.sourceType)) {
    const receipt =
      first.sourceType === "CUSTOMER_RECEIPT"
        ? await tx.customerReceipt.findFirstOrThrow({
            where: { id: first.sourceId, companyId: c },
          })
        : await tx.customerRefund.findFirstOrThrow({
            where: { id: first.sourceId, companyId: c },
          });
    const bank = await tx.financeBankAccount.findFirst({
      where: {
        id: receipt.bankAccountId ?? "00000000-0000-0000-0000-000000000000",
        companyId: c,
        active: true,
        currency,
      },
    });
    if (!bank) throw new ConflictException("BANK_ACCOUNT_REQUIRED");
    if (
      await tx.bankStatement.count({
        where: {
          companyId: c,
          bankAccountId: bank.id,
          state: "CLOSED",
          endsOn: { gte: businessDate },
        },
      })
    )
      throw new ConflictException("BANK_RECONCILIATION_PERIOD_CLOSED");
    bankAccount = bank.accountId;
  }
  const lines = [];
  for (const [index, row] of input.data.entries()) {
    const debit = d(row.debit.toString()),
      credit = d(row.credit.toString());
    if (debit.lt(0) || credit.lt(0) || (debit.gt(0) && credit.gt(0)))
      throw new ConflictException("JOURNAL_AMOUNT_INVALID");
    const accountId =
      input.accountIds?.[index] ??
      (["CASH_RECEIPT", "CASH_REFUND"].includes(row.kind) && bankAccount
        ? bankAccount
        : mapping[row.kind]);
    if (!accountId) throw new ConflictException(`POSTING_MAPPING_REQUIRED:${row.kind}`);
    const account = await tx.financeAccount.findFirst({
      where: { id: accountId, companyId: c, active: true },
    });
    if (!account) throw new ConflictException("POSTING_ACCOUNT_INVALID");
    const mappedBanks = await tx.financeBankAccount.findMany({
      where: { companyId: c, accountId },
    });
    if (mappedBanks.some((b) => b.currency !== currency))
      throw new ConflictException("BANK_CURRENCY_MISMATCH");
    if (
      await tx.bankStatement.count({
        where: {
          companyId: c,
          bankAccountId: { in: mappedBanks.map((b) => b.id) },
          state: "CLOSED",
          endsOn: { gte: businessDate },
        },
      })
    )
      throw new ConflictException("BANK_RECONCILIATION_PERIOD_CLOSED");
    lines.push({
      companyId: c,
      accountId,
      ledgerKind: row.kind,
      debit,
      credit,
      snapshot: {
        code: account.code,
        name: account.name,
        category: account.category,
        control_kind: account.controlKind,
      },
    });
  }
  if (!lines.reduce((sum, l) => sum.add(l.debit).sub(l.credit), d(0)).eq(0))
    throw new ConflictException("JOURNAL_UNBALANCED");
  const journal = await tx.financeJournal.create({
    data: {
      companyId: c,
      sourceType: first.sourceType,
      sourceId: first.sourceId,
      businessDate,
      periodId: periods[0]!.id,
      profileId: profile.id,
      currency,
      actorId: actor,
      lines: { create: lines },
    },
  });
  await tx.ledgerEntry.createMany({
    data: input.data.map((l) => ({ ...l, currency, journalId: journal.id })),
  });
  return journal;
}
