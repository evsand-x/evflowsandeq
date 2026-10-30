import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { salesInvoiceDraftSchema, type SalesInvoiceDraftInput } from "@evflow/contracts";
import { transactionCommand } from "../common/transaction-command";
import { nextDocumentNumber } from "../common/document-number";
import { AuditService } from "../common/audit.service";
import { getDeliveryNote } from "../sales/delivery-note";
import { lineAmounts } from "../sales/pricing-controls";
import { lockCustomer } from "../sales/transaction-controls";
import { assertFinancePeriodOpen } from "./period-guard";
import { financeDate, lockFinance, postLedger } from "./posting";
import { businessInstant } from "./business-date";
import { configurationError } from "./invoice-errors";

type Tx = Prisma.TransactionClient;
const Decimal = Prisma.Decimal.clone({ precision: 48 });
const d = (v: Prisma.Decimal.Value) => new Decimal(v);
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const audit = new AuditService();
export function parseInvoiceDraft(input: unknown) {
  const result = salesInvoiceDraftSchema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}

export async function invoiceSource(tx: Tx, c: string, noteId: string) {
  const note = await getDeliveryNote(c, noteId, tx);
  if (note.state !== "ISSUED" || !note.issuedAt)
    throw new ConflictException("DELIVERY_NOTE_NOT_ISSUED");
  const order = await tx.salesOrder.findFirstOrThrow({
    where: { id: note.salesOrderId, companyId: c },
    include: { customer: true },
  });
  const snap = note.snapshot as {
    payment?: { mode?: string; top_days?: number | null };
    company?: unknown;
    products?: Record<
      string,
      { code?: string; name?: string; unit?: string; baseUom?: { name?: string } }
    >;
    freight_amount?: string;
    freight_tax_amount?: string;
    freight_tax_snapshot?: Prisma.JsonValue;
  } | null;
  const payment = snap?.payment;
  if (
    !payment?.mode ||
    !["COD", "PREPAY", "TEMPO"].includes(payment.mode) ||
    (payment.mode === "TEMPO" && (!Number.isInteger(payment.top_days) || payment.top_days! < 0))
  )
    throw new ConflictException("PAYMENT_SNAPSHOT_REQUIRED");
  const dueDate = await financeDate(tx, c, note.issuedAt);
  dueDate.setUTCDate(dueDate.getUTCDate() + (payment.mode === "TEMPO" ? payment.top_days! : 0));
  const lines = note.lines
    .filter((l) => d(l.deliveredQuantity ?? "0").gt(0))
    .map((l) => ({
      sales_order_line_id: l.salesOrderLineId,
      product_code: snap?.products?.[l.salesOrderLineId]?.code ?? l.salesOrderLine.product.code,
      product: snap?.products?.[l.salesOrderLineId]?.name ?? l.salesOrderLine.product.name,
      unit:
        snap?.products?.[l.salesOrderLineId]?.unit ??
        snap?.products?.[l.salesOrderLineId]?.baseUom?.name ??
        l.salesOrderLine.product.baseUom.name,
      quantity: l.deliveredQuantity!.toString(),
      unit_price: l.unitPrice.toString(),
      tax_snapshot: l.taxSnapshot,
      amounts: lineAmounts(l, l.deliveredQuantity!),
    }));
  const subtotal = lines.reduce((sum, l) => sum.add(l.amounts.net), d("0"));
  const taxAmount = lines.reduce((sum, l) => sum.add(l.amounts.tax), d("0"));
  const freightAmount = d(snap?.freight_amount ?? "0"),
    freightTaxAmount = d(snap?.freight_tax_amount ?? "0");
  const total = subtotal.add(taxAmount).add(freightAmount).add(freightTaxAmount);
  if (total.lte(0)) throw new ConflictException("INVOICE_QUANTITY_REQUIRED");
  const company = await tx.company.findUniqueOrThrow({
    where: { id: c },
    select: { name: true, address: true, phone: true },
  });
  return {
    note,
    order,
    subtotal,
    taxAmount,
    freightAmount,
    freightTaxAmount,
    total,
    dueDate,
    snapshot: json({
      source: "DELIVERY_NOTE",
      delivery_note_id: note.id,
      delivery_note_number: note.number,
      delivery_note_date: note.documentDate,
      delivery_note_issued_at: note.issuedAt,
      sales_order_number: order.number,
      sales_order_date: order.orderDate,
      payment,
      due_date: dueDate,
      company: snap?.company ?? company,
      customer: {
        id: order.customerId,
        code: order.customer.code,
        name: order.customer.name,
        legal_name: order.customer.legalName,
        billing_address: order.customer.billingAddress ?? order.customer.primaryAddress,
      },
      delivery_address: order.deliveryAddress,
      currency: order.currency,
      lines,
      freight: {
        amount: freightAmount,
        tax: freightTaxAmount,
        tax_snapshot: snap?.freight_tax_snapshot ?? null,
      },
    }),
  };
}
async function lockSource(tx: Tx, c: string, noteId: string) {
  const ref = await tx.deliveryNote.findFirst({
    where: { id: noteId, companyId: c },
    select: { salesOrder: { select: { customerId: true } } },
  });
  if (!ref) throw new NotFoundException("Surat Jalan tidak ditemukan.");
  await lockCustomer(tx, c, ref.salesOrder.customerId);
  await tx.$queryRaw`SELECT id FROM delivery_notes WHERE id=${noteId}::uuid AND company_id=${c}::uuid FOR UPDATE`;
  await lockFinance(tx, c);
}
async function reserveNumber(tx: Tx, c: string, input: string | undefined, id?: string) {
  if (input) {
    if (
      await tx.salesInvoice.findFirst({
        where: { companyId: c, number: input, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
      })
    )
      throw new ConflictException("INVOICE_NUMBER_EXISTS");
    return input;
  }
  let number = await nextDocumentNumber(tx, c, "sales_invoice");
  // A user may have selected a future sequence value. Consume collisions, never reuse an issued number.
  while (await tx.salesInvoice.count({ where: { companyId: c, number } }))
    number = await nextDocumentNumber(tx, c, "sales_invoice");
  return number;
}
export async function saveInvoiceDraftTx(
  tx: Tx,
  c: string,
  a: string,
  i: SalesInvoiceDraftInput,
  id?: string,
) {
  await lockSource(tx, c, i.surat_jalan_id);
  const existing = await tx.salesInvoice.findFirst({
    where: { companyId: c, deliveryNoteId: i.surat_jalan_id },
  });
  if (id && (!existing || existing.id !== id))
    throw new NotFoundException("Invoice tidak ditemukan.");
  if (!id && existing) throw new ConflictException("DELIVERY_NOTE_ALREADY_INVOICED");
  if (existing && existing.state !== "DRAFT") throw new ConflictException("INVOICE_NOT_DRAFT");
  if (existing && i.version !== existing.version)
    throw new ConflictException("INVOICE_VERSION_CONFLICT");
  const source = await invoiceSource(tx, c, i.surat_jalan_id);
  const invoiceDate = i.invoice_date
    ? new Date(i.invoice_date)
    : (existing?.invoiceDate ?? (await financeDate(tx, c)));
  await assertFinancePeriodOpen(tx, c, invoiceDate);
  const number = await reserveNumber(tx, c, i.number ?? existing?.number, id);
  const data = {
    number,
    invoiceDate,
    notes: i.notes ?? existing?.notes ?? "",
    dueDate: source.dueDate,
    subtotal: source.subtotal,
    taxAmount: source.taxAmount,
    total: source.total,
    freightAmount: source.freightAmount,
    freightTaxAmount: source.freightTaxAmount,
    freightSnapshot: json({ amount: source.freightAmount, tax: source.freightTaxAmount }),
    issuedSnapshot: existing?.issuedSnapshot ? json(existing.issuedSnapshot) : source.snapshot,
  };
  const row = existing
    ? await tx.salesInvoice.update({
        where: { id: existing.id },
        data: { ...data, version: { increment: 1 } },
      })
    : await tx.salesInvoice.create({
        data: {
          ...data,
          companyId: c,
          customerId: source.order.customerId,
          salesOrderId: source.order.id,
          deliveryNoteId: source.note.id,
          currency: source.order.currency,
          state: "DRAFT",
          outstandingAmount: "0",
        },
      });
  await audit.recordWith(tx, {
    companyId: c,
    actorId: a,
    action: existing ? "sales_invoice.draft_updated" : "sales_invoice.draft_created",
    resourceType: "sales_invoice",
    resourceId: row.id,
    before: existing ?? undefined,
    after: row,
  });
  return row;
}
export async function saveInvoiceDraft(
  c: string,
  a: string,
  input: unknown,
  key: string,
  id?: string,
) {
  const i = parseInvoiceDraft(input);
  return transactionCommand(
    c,
    a,
    id ? `sales-invoices/${id}/draft` : "sales-invoices/draft",
    key,
    i,
    (tx) => saveInvoiceDraftTx(tx, c, a, i, id),
  ).catch(configurationError);
}
export async function submitInvoiceTx(tx: Tx, c: string, a: string, id: string, version: number) {
  const ref = await tx.salesInvoice.findFirst({ where: { id, companyId: c } });
  if (!ref?.deliveryNoteId) throw new NotFoundException("Invoice Surat Jalan tidak ditemukan.");
  await lockSource(tx, c, ref.deliveryNoteId);
  await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
  const invoice = await tx.salesInvoice.findFirstOrThrow({ where: { id, companyId: c } });
  if (invoice.state === "POSTED") return invoice;
  if (invoice.state !== "DRAFT") throw new ConflictException("INVOICE_NOT_DRAFT");
  if (invoice.version !== version) throw new ConflictException("INVOICE_VERSION_CONFLICT");
  const source = await invoiceSource(tx, c, ref.deliveryNoteId);
  if (!invoice.total?.eq(source.total)) throw new ConflictException("INVOICE_SOURCE_CHANGED");
  if (!invoice.invoiceDate) throw new ConflictException("INVOICE_DATE_REQUIRED");
  await postLedger(tx, a, {
    businessDate: await businessInstant(tx, c, invoice.invoiceDate.toISOString().slice(0, 10)),
    data: [
      {
        companyId: c,
        kind: "AR",
        sourceType: "SALES_INVOICE",
        sourceId: id,
        currency: invoice.currency,
        debit: invoice.total,
        credit: d("0"),
      },
      {
        companyId: c,
        kind: "UNBILLED_AR",
        sourceType: "SALES_INVOICE",
        sourceId: id,
        currency: invoice.currency,
        debit: d("0"),
        credit: invoice.total,
      },
    ],
  });
  const row = await tx.salesInvoice.update({
    where: { id },
    data: {
      state: "POSTED",
      postedAt: new Date(),
      outstandingAmount: invoice.total,
      version: { increment: 1 },
      issuedSnapshot: json({
        ...(invoice.issuedSnapshot as object),
        number: invoice.number,
        invoice_date: invoice.invoiceDate,
        notes: invoice.notes,
        status: "POSTED",
      }),
    },
  });
  await audit.recordWith(tx, {
    companyId: c,
    actorId: a,
    action: "sales_invoice.posted",
    resourceType: "sales_invoice",
    resourceId: id,
    after: row,
  });
  await tx.outboxEvent.create({
    data: {
      companyId: c,
      aggregateId: id,
      eventType: "sales_invoice.posted",
      payload: json({ invoice_id: id, delivery_note_id: invoice.deliveryNoteId }),
    },
  });
  return row;
}
export function submitInvoice(c: string, a: string, id: string, version: number, key: string) {
  return transactionCommand(c, a, `sales-invoices/${id}/submit`, key, { version }, (tx) =>
    submitInvoiceTx(tx, c, a, id, version),
  ).catch(configurationError);
}
/** Compatibility command: create and submit commit together; existing draft must use explicit submit/version. */
export function createAndPostInvoice(c: string, a: string, input: unknown, key: string) {
  const i = parseInvoiceDraft(input);
  return transactionCommand(
    c,
    a,
    `sales-invoices/from-delivery-note/${i.surat_jalan_id}`,
    key,
    i,
    async (tx) => {
      await lockSource(tx, c, i.surat_jalan_id);
      const existing = await tx.salesInvoice.findFirst({
        where: { companyId: c, deliveryNoteId: i.surat_jalan_id },
      });
      if (existing?.state === "POSTED") return existing;
      const draft = await saveInvoiceDraftTx(tx, c, a, i);
      return submitInvoiceTx(tx, c, a, draft.id, draft.version);
    },
  ).catch(configurationError);
}
