import { BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import { salesInvoiceListSchema } from "@evflow/contracts";
import { previewDocumentNumber } from "../common/document-number";
import { invoiceSource } from "./invoice";
import { financeDate } from "./posting";
type Tx = Prisma.TransactionClient;

export async function invoiceCandidates(
  c: string,
  input: { page?: number; search?: string; customerId?: string },
  tx: Tx = prisma,
) {
  const page = input.page ?? 1,
    search = input.search ?? "";
  const where: Prisma.DeliveryNoteWhereInput = {
    companyId: c,
    state: "ISSUED",
    invoices: { none: {} },
    ...(input.customerId ? { salesOrder: { customerId: input.customerId } } : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { salesOrder: { customer: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    tx.deliveryNote.findMany({
      where,
      select: {
        id: true,
        number: true,
        documentDate: true,
        issuedAt: true,
        salesOrder: {
          select: { id: true, number: true, customer: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 25,
      take: 25,
    }),
    tx.deliveryNote.count({ where }),
  ]);
  return { rows, total, page, pageSize: 25 };
}
export async function invoiceForm(
  c: string,
  input: { deliveryNoteId?: string; invoiceId?: string },
  tx: Tx = prisma,
) {
  const draft = input.invoiceId
    ? await tx.salesInvoice.findFirst({ where: { id: input.invoiceId, companyId: c } })
    : null;
  if (input.invoiceId && !draft) throw new NotFoundException("Invoice tidak ditemukan.");
  const noteId = draft?.deliveryNoteId ?? input.deliveryNoteId;
  if (!noteId) throw new BadRequestException("Surat Jalan wajib dipilih.");
  const source = await invoiceSource(tx, c, noteId);
  return {
    nextNumber: await previewDocumentNumber(tx, c, "sales_invoice"),
    invoiceDate: await financeDate(tx, c),
    draft,
    source: {
      deliveryNoteId: source.note.id,
      total: source.total,
      subtotal: source.subtotal,
      taxAmount: source.taxAmount,
      freightAmount: source.freightAmount,
      freightTaxAmount: source.freightTaxAmount,
      dueDate: source.dueDate,
      snapshot: draft?.issuedSnapshot ?? source.snapshot,
    },
  };
}
export async function invoiceList(c: string, input: unknown, tx: Tx = prisma) {
  const parsed = salesInvoiceListSchema.safeParse(input);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  const i = parsed.data,
    today = await financeDate(tx, c);
  const where: Prisma.SalesInvoiceWhereInput = {
    companyId: c,
    ...(i.customer_id ? { customerId: i.customer_id } : {}),
    ...(i.search
      ? {
          OR: [
            { number: { contains: i.search, mode: "insensitive" } },
            { deliveryNote: { number: { contains: i.search, mode: "insensitive" } } },
            { customer: { name: { contains: i.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const posted: Prisma.SalesInvoiceWhereInput = { state: "POSTED" };
  const conditions: Record<string, Prisma.SalesInvoiceWhereInput> = {
    ALL: {},
    DRAFT: { state: "DRAFT" },
    UNPAID: { ...posted, outstandingAmount: { gt: 0, equals: tx.salesInvoice.fields.total } },
    PARTIAL: { ...posted, outstandingAmount: { gt: 0, lt: tx.salesInvoice.fields.total } },
    OVERDUE: { ...posted, outstandingAmount: { gt: 0 }, dueDate: { lt: today } },
    PAID: { ...posted, outstandingAmount: 0 },
  };
  const summary = Object.fromEntries(
    await Promise.all(
      Object.entries(conditions).map(async ([tab, condition]) => [
        tab,
        await tx.salesInvoice.count({ where: { AND: [where, condition] } }),
      ]),
    ),
  );
  const rows = await tx.salesInvoice.findMany({
    where: { AND: [where, conditions[i.tab]!] },
    skip: (i.page - 1) * 25,
    take: 25,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      number: true,
      state: true,
      invoiceDate: true,
      createdAt: true,
      dueDate: true,
      total: true,
      outstandingAmount: true,
      version: true,
      customer: { select: { id: true, name: true } },
      deliveryNote: { select: { id: true, number: true, issuedAt: true } },
    },
  });
  return {
    rows: rows.map((r) => ({
      ...r,
      status:
        r.state === "DRAFT"
          ? "DRAFT"
          : r.state === "VOID"
            ? "VOID"
            : r.outstandingAmount.isZero()
              ? "PAID"
              : r.total && r.outstandingAmount.lt(r.total)
                ? "PARTIAL"
                : "UNPAID",
      overdue: !!r.dueDate && r.dueDate < today && r.outstandingAmount.gt(0),
    })),
    total: summary[i.tab]!,
    summary,
    page: i.page,
    pageSize: 25,
  };
}
export async function invoiceDetail(
  c: string,
  id: string,
  receiptsAllowed = false,
  tx: Tx = prisma,
) {
  const row = await tx.salesInvoice.findFirst({
    where: { id, companyId: c },
    include: {
      deliveryNote: { select: { id: true, number: true, issuedAt: true, documentDate: true } },
      salesOrder: { select: { id: true, number: true, orderDate: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  if (!row) throw new NotFoundException("Invoice tidak ditemukan.");
  const total =
    row.total ?? row.subtotal.add(row.taxAmount).add(row.freightAmount).add(row.freightTaxAmount);
  const pending = await tx.invoicePaymentDeduction.aggregate({
    where: { companyId: c, invoiceId: id, state: "PENDING_PROOF" },
    _sum: { amount: true },
  });
  const pendingAmount = pending._sum.amount ?? new Prisma.Decimal(0);
  const status =
    row.state === "DRAFT"
      ? "DRAFT"
      : row.state === "VOID"
        ? "VOID"
        : row.outstandingAmount.isZero()
          ? "PAID"
          : pendingAmount.gt(0) && pendingAmount.eq(row.outstandingAmount)
            ? "PENDING_PROOF"
            : row.outstandingAmount.lt(total)
              ? "PARTIAL"
              : "UNPAID";
  const payments = receiptsAllowed
    ? await tx.customerReceiptAllocation.findMany({
        where: { companyId: c, invoiceId: id, receipt: { state: "POSTED" } },
        select: {
          id: true,
          amount: true,
          receipt: {
            select: {
              id: true,
              number: true,
              receivedAt: true,
              bankAccountId: true,
              bankReference: true,
              externalReference: true,
              amount: true,
              evidenceId: true,
            },
          },
        },
        orderBy: [{ receipt: { receivedAt: "desc" } }, { id: "asc" }],
      })
    : undefined;
  const banks = payments
    ? await tx.financeBankAccount.findMany({
        where: {
          companyId: c,
          id: {
            in: payments.flatMap((p) => (p.receipt.bankAccountId ? [p.receipt.bankAccountId] : [])),
          },
        },
        select: { id: true, name: true, lastFour: true },
      })
    : [];
  return {
    ...row,
    total,
    snapshot: row.issuedSnapshot,
    status,
    settledAmount: row.state === "DRAFT" ? "0" : total.sub(row.outstandingAmount).toString(),
    ...(receiptsAllowed
      ? {
          pendingProofAmount: pendingAmount,
          payments: payments!.map((p) => ({
            ...p,
            bank: banks.find((b) => b.id === p.receipt.bankAccountId) ?? null,
          })),
          deductions: await tx.invoicePaymentDeduction.findMany({
            where: { companyId: c, invoiceId: id },
            orderBy: { createdAt: "asc" },
          }),
        }
      : {}),
  };
}
