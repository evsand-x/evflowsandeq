import { orderDetail } from "./order-detail";
import { type OrderPermission } from "./order-related";
import { availablePrepayFunds } from "./prepay-funds";
import { randomUUID, createHash } from "node:crypto";
import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { parseServerEnv } from "@evflow/config/env";
import { AuditService } from "../common/audit.service";
import { transactionCommand } from "../common/transaction-command";
import {
  type OrderListFilters,
} from "./order-list-filters";
import { proformaKinds, proformaStatus } from "./proforma";
import { lineAmounts, rejectTaxChoice } from "./pricing-controls";
import { defaultSalesTaxOn } from "../finance/operational-tax";
import { paymentTerms } from "./customer-credit";
import { listSalesOrders } from "./order-list";
import { orderFormOptions } from "./order-availability";

@Injectable()
export class OperationsService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}
  async approvalPolicy(
    c: string,
    a: string,
    i: {
      currency: string;
      document_kind?:
        | "PURCHASE_REQUEST"
        | "SALES_ORDER_UNLOCK"
        | "SPECIAL_PRICE"
        | "BANK_TRANSACTION"
        | "TAX_CORRECTION"
        | "CUSTOMER_REFUND"
        | "SOURCE_REVERSAL"
        | "FINANCE_CLOSE"
        | "TAX_RULE_CHANGE"
        | "ADVANCE_REFUND"
        | undefined;
      allowed_reasons?: string[] | undefined;
      grant_hours?: number | undefined;
      maximum_amount: string;
      steps: { mode: string; user_ids: string[] }[];
      effective_from: string;
      effective_to: string;
    },
    key: string,
  ) {
    return transactionCommand(c, a, "approval-policies/create", key, i, async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${c}::uuid FOR UPDATE`;
      const from = new Date(i.effective_from),
        to = new Date(i.effective_to);
      if (to <= from || new Prisma.Decimal(i.maximum_amount).lte(0))
        throw new ConflictException("APPROVAL_POLICY_INVALID");
      if (
        i.document_kind &&
        ["SALES_ORDER_UNLOCK", "SPECIAL_PRICE"].includes(i.document_kind) &&
        !i.grant_hours
      )
        throw new ConflictException("GRANT_DURATION_REQUIRED");
      if (i.document_kind === "SALES_ORDER_UNLOCK" && !i.allowed_reasons?.length)
        throw new ConflictException("UNLOCK_SCOPE_REQUIRED");
      const ids = [...new Set(i.steps.flatMap((s) => s.user_ids))];
      if (
        (await tx.companyMembership.count({
          where: { companyId: c, userId: { in: ids }, active: true, user: { active: true } },
        })) !== ids.length
      )
        throw new ConflictException("APPROVER_COMPANY_MISMATCH");
      if (
        await tx.transactionApprovalPolicy.count({
          where: {
            companyId: c,
            documentKind: i.document_kind ?? "PURCHASE_REQUEST",
            currency: i.currency,
            effectiveFrom: { lt: to },
            effectiveTo: { gt: from },
          },
        })
      )
        throw new ConflictException("APPROVAL_POLICY_OVERLAP");
      const rule = await tx.transactionApprovalPolicy.create({
        data: {
          companyId: c,
          documentKind: i.document_kind ?? "PURCHASE_REQUEST",
          allowedReasons: i.allowed_reasons ?? Prisma.DbNull,
          grantHours: i.grant_hours ?? null,
          currency: i.currency,
          maximumAmount: i.maximum_amount,
          allowSelf: false,
          steps: i.steps,
          effectiveFrom: from,
          effectiveTo: to,
          createdById: a,
        },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "approval_policy.created",
        resourceType: "transaction_approval_policy",
        resourceId: rule.id,
        after: rule,
      });
      return rule;
    });
  }
  private storage() {
    const e = parseServerEnv(process.env);
    return {
      bucket: e.S3_BUCKET_PRIVATE,
      client: new S3Client({
        endpoint: e.S3_ENDPOINT,
        region: e.S3_REGION,
        forcePathStyle: e.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
      }),
    };
  }
  async upload(c: string, a: string, purpose: string, name: string, base64: string) {
    const source = Buffer.from(base64, "base64");
    if (source.length > 2 * 1024 * 1024 || !source.length)
      throw new BadRequestException("Bukti gambar maksimal 2 MB.");
    let bytes: Buffer;
    try {
      const input = sharp(source, { limitInputPixels: 16000000, failOn: "warning" });
      const meta = await input.metadata();
      if (!["jpeg", "png"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1)
        throw new Error("format");
      bytes = await input.rotate().png().toBuffer();
    } catch {
      throw new BadRequestException("Bukti harus gambar JPEG/PNG yang valid.");
    }
    if (bytes.length > 8 * 1024 * 1024)
      throw new BadRequestException("Gambar hasil normalisasi terlalu besar.");
    const id = randomUUID(),
      objectKey = `transactions/${c}/${id}.png`;
    const { client, bucket } = this.storage();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: "image/png",
      }),
    );
    return prisma.$transaction(async (tx) => {
      const row = await tx.transactionEvidence.create({
        data: {
          id,
          companyId: c,
          actorId: a,
          purpose,
          originalName: name,
          objectKey,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          sizeBytes: bytes.length,
        },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "transaction_evidence.created",
        resourceType: "transaction_evidence",
        resourceId: id,
        after: row,
      });
      return { id, purpose, sha256: row.sha256, name };
    });
  }
  async evidence(c: string, id: string) {
    const row = await prisma.transactionEvidence.findFirst({ where: { companyId: c, id } });
    if (!row) throw new NotFoundException("Bukti tidak ditemukan.");
    const { client, bucket } = this.storage();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: row.objectKey }));
    return {
      id,
      purpose: row.purpose,
      name: row.originalName,
      sha256: row.sha256,
      image: `data:image/png;base64,${Buffer.from(await result.Body!.transformToByteArray()).toString("base64")}`,
    };
  }
  async shipment(
    c: string,
    a: string,
    id: string,
    input: {
      driver: string;
      vehicle: string;
      planned_at: string;
      freight?:
        | { amount: string; tax_mode: "NON_TAXABLE" | "TAXABLE"; tax_rule_id?: string | undefined }
        | undefined;
    },
    key: string,
  ) {
    rejectTaxChoice({ freight: input.freight });
    return transactionCommand(c, a, `fulfillments/${id}/shipment`, key, input, async (tx) => {
      await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
      const batch = await tx.fulfillmentBatch.findFirst({ where: { id, companyId: c } });
      if (!batch) throw new NotFoundException();
      if (batch.state !== "ALLOCATED") throw new ConflictException("SHIPMENT_ALREADY_DISPATCHED");
      const order = await tx.salesOrder.findUniqueOrThrow({ where: { id: batch.salesOrderId } });
      const terms = (order.freightTermsSnapshot ?? {}) as {
        payer?: string;
        basis?: string;
        tax_mode?: "NON_TAXABLE" | "TAXABLE";
      };
      const freight = input.freight ?? {
        amount: order.freightEstimate?.toString() ?? "0",
        tax_mode: terms.tax_mode ?? "NON_TAXABLE",
      };
      const amount = new Prisma.Decimal(freight.amount);
      if (amount.lt(0)) throw new ConflictException("FREIGHT_AMOUNT_INVALID");
      let taxAmount = new Prisma.Decimal(0);
      let taxSnapshot: Prisma.JsonValue | null = null;
      if (freight.tax_mode === "TAXABLE") {
        // Taxable freight uses the default sales tax; per-customer rules are no longer read.
        const freightTax = await defaultSalesTaxOn(tx, c, amount);
        taxAmount = freightTax.tax;
        taxSnapshot = freightTax.snapshot;
      }
      const after = await tx.fulfillmentBatch.update({
        where: { id },
        data: {
          shipmentSnapshot: {
            driver: input.driver,
            vehicle: input.vehicle,
            planned_at: input.planned_at,
          },
          freightAmount: amount,
          freightTaxAmount: taxAmount,
          freightTaxSnapshot: taxSnapshot ?? Prisma.DbNull,
          freightVersion: { increment: 1 },
        },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "shipment.prepared",
        resourceType: "fulfillment_batch",
        resourceId: id,
        after,
      });
      return after;
    });
  }
  async quality(
    c: string,
    a: string,
    id: string,
    input: { state: string; reason: string },
    key: string,
  ) {
    return transactionCommand(c, a, `stock/${id}/quality`, key, input, async (tx) => {
      await tx.$queryRaw`SELECT id FROM stock_lots WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
      const before = await tx.stockLot.findFirst({
        where: { id, companyId: c },
        include: { locator: true },
      });
      if (!before) throw new NotFoundException();
      if (
        input.state === "AVAILABLE" &&
        (!["STORAGE", "DISPATCH"].includes(before.locator.locatorType) ||
          before.qualityState === "RECALL")
      )
        throw new ConflictException("QUALITY_RELEASE_NOT_ELIGIBLE");
      const after = await tx.stockLot.update({
        where: { id },
        data: { qualityState: input.state, qualityReason: input.reason },
      });
      // Backorders are never reallocated by a stock event. A user must explicitly
      // invoke the reallocation command so the reservation is intentional and auditable.
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "stock.quality_decided",
        resourceType: "stock_lot",
        resourceId: id,
        before,
        after,
        reason: input.reason,
      });
      return after;
    });
  }
  async list(
    c: string,
    kind: string,
    page: number,
    search: string,
    state?: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED",
    stage?: "checking" | "shipping" | "pod",
    view?: string,
    orderFilters: OrderListFilters = {},
    includeFinancial = true,
  ) {
    const skip = (page - 1) * 25,
      query = { contains: search, mode: "insensitive" as const };
    if (kind === "proformas") {
      const where: Prisma.FulfillmentDocumentWhereInput = { companyId: c, kind: proformaKinds };
      const docs = await prisma.fulfillmentDocument.findMany({
        where,
        orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
        select: { id: true, number: true, batchId: true, issuedAt: true, snapshot: true },
      });
      const batches = await prisma.fulfillmentBatch.findMany({
        where: { companyId: c, id: { in: docs.map((d) => d.batchId) } },
        select: {
          id: true,
          number: true,
          state: true,
          salesOrder: { select: { id: true, number: true, customer: { select: { name: true } } } },
        },
      });
      const rows = await Promise.all(
        docs
          .filter((d) => {
            if (!search) return true;
            const batch = batches.find((b) => b.id === d.batchId);
            return Boolean(
              d.number.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
                batch?.number.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
                batch?.salesOrder.number.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
                batch?.salesOrder.customer.name
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
            );
          })
          .map(async ({ snapshot, ...d }) => ({
            ...d,
            batch: batches.find((b) => b.id === d.batchId),
            status: await proformaStatus(c, { ...d, snapshot }),
            pending: false,
            value:
              (snapshot as { total?: string } | null)?.total ??
              (Array.isArray((snapshot as { allocations?: unknown[] } | null)?.allocations) &&
              (snapshot as { allocations: { amounts?: { total?: string } }[] }).allocations.every(
                (line) => line.amounts?.total != null,
              )
                ? (snapshot as { allocations: { amounts: { total: string } }[] }).allocations
                    .reduce((sum, line) => sum.add(line.amounts.total), new Prisma.Decimal(0))
                    .toString()
                : null),
            currency: (snapshot as { currency?: string } | null)?.currency ?? null,
          })),
      );
      const pendingBatches = await prisma.fulfillmentBatch.findMany({
        where: {
          companyId: c,
          state: "ALLOCATED",
          ...(search
            ? {
                OR: [
                  { number: query },
                  { salesOrder: { number: query } },
                  { salesOrder: { customer: { name: query } } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          number: true,
          state: true,
          createdAt: true,
          salesOrder: { select: { id: true, number: true, customer: { select: { name: true } } } },
        },
      });
      const issuedBatchIds = new Set(docs.map((d) => d.batchId));
      const pending = pendingBatches
        .filter((b) => !issuedBatchIds.has(b.id))
        .map((b) => ({
          id: `pending:${b.id}`,
          number: "Belum diterbitkan",
          batchId: b.id,
          issuedAt: b.createdAt,
          snapshot: null,
          batch: b,
          status: "PENDING" as const,
          pending: true,
        }));
      const combined = [...rows, ...pending].sort(
        (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
      );
      const summary: Record<string, number> = {
        ISSUED: 0,
        REVISION_REQUIRED: 0,
        SUPERSEDED: 0,
        PENDING: 0,
        VOID: 0,
      };
      for (const row of combined) summary[row.status] = (summary[row.status] ?? 0) + 1;
      const filtered = combined.filter((r) => !view || view === "ALL" || r.status === view);
      return { rows: filtered.slice(skip, skip + 25), total: filtered.length, summary };
    }
    if (kind === "orders") return listSalesOrders(c, page, search, state, orderFilters, undefined, includeFinancial);
    if (kind === "warehouse") {
      const where: Prisma.FulfillmentBatchWhereInput = {
        companyId: c,
        OR: [
          { number: query },
          { salesOrder: { number: query } },
          { salesOrder: { customer: { name: query } } },
        ],
        ...(stage === "checking"
          ? { state: "ALLOCATED", pickList: { is: { state: "PICKED" } } }
          : stage === "shipping"
            ? { state: "ALLOCATED", pickList: { is: { state: "CHECKED" } } }
            : stage === "pod"
              ? { state: { in: ["DISPATCHED", "PARTIALLY_DELIVERED"] } }
              : {}),
      };
      const [rows, total] = await prisma.$transaction([
        prisma.fulfillmentBatch.findMany({
          where,
          skip,
          take: 25,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          include: {
            salesOrder: { select: { number: true, customer: { select: { name: true } } } },
            pickList: { select: { state: true } },
          },
        }),
        prisma.fulfillmentBatch.count({ where }),
      ]);
      return { rows, total };
    }
    if (kind === "pick-slips") {
      const where = {
        companyId: c,
        AND: [
          { OR: [{ state: "ALLOCATED" as const }, { pickList: { isNot: null } }] },
          ...(search
            ? [
                {
                  OR: [
                    { number: query },
                    { salesOrder: { number: query } },
                    { salesOrder: { customer: { name: query } } },
                  ],
                },
              ]
            : []),
        ],
      };
      const [rows, total] = await prisma.$transaction([
        prisma.fulfillmentBatch.findMany({
          where,
          skip,
          take: 25,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          include: {
            salesOrder: {
              select: { id: true, number: true, customer: { select: { name: true } } },
            },
            pickList: { include: { lines: true } },
          },
        }),
        prisma.fulfillmentBatch.count({ where }),
      ]);
      return { rows, total };
    }
    const allInvoices = await prisma.salesInvoice.findMany({
      where: { companyId: c, OR: [{ number: query }, { customer: { name: query } }] },
      select: {
        id: true,
        state: true,
        dueDate: true,
        outstandingAmount: true,
        total: true,
        subtotal: true,
        taxAmount: true,
      },
    });
    const handoffs = await prisma.auditEvent.findMany({
      where: {
        companyId: c,
        resourceType: "commercial_invoice",
        action: "commercial_document.handed_over",
        resourceId: { in: allInvoices.map((r) => r.id) },
      },
      select: { resourceId: true, metadata: true },
      orderBy: { occurredAt: "desc" },
    });
    const handed = new Set(handoffs.map((r) => r.resourceId));
    const matches = (r: (typeof allInvoices)[number], v: string) => {
      if (v === "ALL") return true;
      const posted = ["POSTED", "PARTIALLY_PAID", "PAID"].includes(r.state);
      if (v === "HANDOFF") return posted && !handed.has(r.id);
      if (v === "PAID") return posted && r.outstandingAmount.isZero();
      if (v === "UNPAID")
        return posted && r.outstandingAmount.gte(r.total ?? r.subtotal.add(r.taxAmount));
      if (v === "PARTIAL")
        return (
          posted &&
          r.outstandingAmount.gt(0) &&
          r.outstandingAmount.lt(r.total ?? r.subtotal.add(r.taxAmount))
        );
      if (v === "OVERDUE")
        return posted && r.outstandingAmount.gt(0) && !!r.dueDate && r.dueDate < new Date();
      return true;
    };
    const selected = allInvoices.filter((r) => matches(r, view ?? "ALL"));
    const invoiceSummary = Object.fromEntries(
      ["HANDOFF", "OVERDUE", "PAID", "PARTIAL"].map((v) => [
        v,
        allInvoices.filter((r) => matches(r, v)).length,
      ]),
    );
    const where = { companyId: c, id: { in: selected.map((r) => r.id) } };
    const [rows, total] = await prisma.$transaction([
      prisma.salesInvoice.findMany({
        where,
        skip,
        take: 25,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          customer: { select: { name: true } },
          salesOrder: { select: { number: true } },
        },
      }),
      prisma.salesInvoice.count({ where }),
    ]);
    return {
      rows: await Promise.all(
        rows.map(async (invoice) => ({
          ...invoice,
          total: invoice.total ?? invoice.subtotal.add(invoice.taxAmount),
          description: await this.invoiceDescription(c, invoice),
          handoff: handed.has(invoice.id) ? "Diserahkan" : "Belum diserahkan",
        })),
      ),
      total,
      summary: invoiceSummary,
    };
  }
  private async invoiceDescription(
    c: string,
    invoice: {
      id: string;
      state: string;
      outstandingAmount: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
    },
  ) {
    if (invoice.state === "DRAFT") return "Draft — belum membentuk piutang";
    if (invoice.state === "ISSUED_WAITING_POD") return "Menunggu POD";
    if (invoice.state === "VOID") return "Dibatalkan";
    const notes: string[] = [];
    const credits = await prisma.creditNote.count({
      where: { companyId: c, salesInvoiceId: invoice.id, state: "POSTED" },
    });
    if (invoice.outstandingAmount.eq(0))
      notes.push(credits ? "Saldo selesai — terdapat nota kredit" : "Sudah Lunas");
    else if (invoice.outstandingAmount.gt(0) && invoice.outstandingAmount.eq(invoice.taxAmount))
      notes.push("DPP Lunas");
    else notes.push("Belum lunas");
    const components = await prisma.receiptTaxComponent.findMany({
      where: { companyId: c, invoiceId: invoice.id },
      select: { kind: true, state: true },
    });
    if (components.some((x) => x.kind === "vat_collected_by_customer" && x.state === "PENDING"))
      notes.push("Bukti pungut/SSP menunggu verifikasi");
    if (components.some((x) => x.kind === "vat_collected_by_customer" && x.state === "POSTED"))
      notes.push("PPN dipungut pelanggan — bukti diposting");
    if (invoice.taxAmount.gt(0)) notes.push("Masih berutang pajak keluaran (belum dilaporkan)");
    return notes.join(" · ");
  }
  async proforma(c: string, id: string, fundsAllowed = false) {
    const document = await prisma.fulfillmentDocument.findFirst({
      where: { companyId: c, id, kind: proformaKinds },
    });
    if (!document) throw new NotFoundException("Proforma tidak ditemukan.");
    const batch = await prisma.fulfillmentBatch.findFirst({
      where: { companyId: c, id: document.batchId },
      select: {
        id: true,
        number: true,
        state: true,
        salesOrder: { select: { id: true, number: true, customer: { select: { name: true } } } },
      },
    });
    const documentCurrency = (document.snapshot as { currency?: string } | null)?.currency;
    const funds = fundsAllowed && documentCurrency && batch
      ? await availablePrepayFunds(prisma, c, { id: document.batchId, salesOrderId: batch.salesOrder.id, currency: documentCurrency })
      : null;
    return {
      ...document,
      batch,
      verifiedFunds: funds?.toString() ?? null,
      status: await proformaStatus(c, document),
    };
  }
  async order(c: string, id: string, can: OrderPermission = () => false) {
    return prisma.$transaction(tx => orderDetail(c, id, can, tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async batch(c: string, id: string) {
    const row = await prisma.fulfillmentBatch.findFirst({
      where: { companyId: c, id },
      include: {
        salesOrder: {
          select: {
            id: true,
            number: true,
            customerId: true,
            deliveryAddress: true,
            customer: { select: { name: true } },
          },
        },
        allocations: {
          select: {
            id: true,
            quantity: true,
            inTransitQuantity: true,
            acceptedQuantity: true,
            returnedQuantity: true,
            stockLot: {
              select: {
                batchNo: true,
                expiryDate: true,
                locator: { select: { code: true } },
                product: {
                  select: { code: true, name: true, baseUom: { select: { name: true } } },
                },
              },
            },
          },
        },
        pickList: { include: { lines: true } },
        deliveryReceipts: {
          include: { lines: true, invoices: { select: { id: true, number: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException();
    const documents = await prisma.fulfillmentDocument.findMany({
      where: { companyId: c, batchId: id, kind: { in: ["PICKING", "PACKING", "SURAT_JALAN"] } },
      select: { id: true, kind: true, number: true, issuedAt: true, snapshot: true },
    });
    return { ...row, documents };
  }
  async invoice(c: string, id: string, receiptsAllowed = false) {
    const row = await prisma.salesInvoice.findFirst({
      where: { companyId: c, id },
      include: {
        customer: { select: { name: true } },
        salesOrder: {
          select: {
            number: true,
            deliveryAddress: true,
            paymentSnapshot: true,
            customerReference: true,
          },
        },
        deliveryReceipt: {
          include: {
            lines: {
              include: {
                allocation: {
                  include: {
                    salesOrderLine: {
                      include: {
                        product: {
                          select: { code: true, name: true, baseUom: { select: { name: true } } },
                        },
                        Uom: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        receiptAllocations: receiptsAllowed,
      },
    });
    if (!row) throw new NotFoundException();
    const receipts = receiptsAllowed ? await prisma.customerReceipt.findMany({
      where: { companyId: c, customerId: row.customerId },
      orderBy: { receivedAt: "desc" },
      take: 100,
    }) : [];
    const document = await prisma.fulfillmentDocument.findFirst({
      where: { companyId: c, kind: `INVOICE:${id}` },
    });
    const company = await prisma.company.findUniqueOrThrow({ where: { id: c } });
    const draft = row.issuedSnapshot as { notes?: string; reference?: string } | null;
    const postedSnapshot = document?.snapshot as {
      lines?: unknown[];
      company?: string;
      customer?: string;
      address?: string;
      reference?: string;
    } | null;
    const snapshot =
      row.state === "DRAFT"
        ? row.issuedSnapshot
        : {
            company: postedSnapshot?.company ?? company.name,
            customer: postedSnapshot?.customer ?? row.customer.name,
            address: postedSnapshot?.address ?? row.salesOrder.deliveryAddress,
            reference: draft?.reference ?? row.salesOrder.customerReference,
            payment: row.salesOrder.paymentSnapshot,
            currency: row.currency,
            subtotal: row.subtotal,
            tax: row.taxAmount,
            total: row.total,
            freight: { amount: row.freightAmount, tax: row.freightTaxAmount },
            allocations:
              postedSnapshot?.lines ??
              row.deliveryReceipt?.lines.map((line) => ({
                product_code: line.allocation.salesOrderLine.product.code,
                product: line.allocation.salesOrderLine.product.name,
                unit:
                  line.allocation.salesOrderLine.Uom?.name ??
                  line.allocation.salesOrderLine.product.baseUom.name,
                quantity: line.acceptedQuantity,
                unit_price: line.allocation.salesOrderLine.unitPrice,
                tax_snapshot: line.allocation.salesOrderLine.taxSnapshot,
                amounts: lineAmounts(line.allocation.salesOrderLine, line.acceptedQuantity),
              })) ??
              [],
          };
    return {
      ...row,
      receipts,
      document,
      snapshot,
      description: await this.invoiceDescription(c, row),
    };
  }
  async lookups(c: string) {
    const [customers, products] = await Promise.all([
      prisma.customer.findMany({
        where: { companyId: c, state: "ACTIVE" },
        select: {
          id: true,
          name: true,
          shippingAddress: true,
          primaryAddress: true,
          defaultTermCode: true,
        },
        orderBy: { name: "asc" },
        take: 250,
      }),
      prisma.product.findMany({
        where: { companyId: c, state: "ACTIVE" },
        select: { id: true, name: true, code: true, baseUom: { select: { name: true } } },
        orderBy: { name: "asc" },
        take: 250,
      }),
    ]);
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: c },
      select: { baseCurrency: true, timezone: true },
    });
    // Only the customer's default term is shown here; credit limit/freeze stay restricted.
    const terms = await paymentTerms(prisma, c);
    return {
      customers: customers.map(({ defaultTermCode, ...customer }) => {
        const term = terms.find((t) => t.code === defaultTermCode);
        return {
          ...customer,
          paymentTerm: term
            ? { code: term.code, label: term.label, mode: term.kind, topDays: term.days }
            : null,
        };
      }),
      products,
      currency: company.baseCurrency,
      timezone: company.timezone,
      ...await orderFormOptions(c),
    };
  }
}
