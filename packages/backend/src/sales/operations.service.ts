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
import { orderView } from "./order-view";
import { proformaKinds, proformaStatus } from "./proforma";

@Injectable()
export class OperationsService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}
  async tax(
    c: string,
    a: string,
    i: {
      customer_id: string;
      product_id: string;
      name: string;
      legal_reference: string;
      taxable_event?: "POD" | "ADVANCE" | undefined;
      rate: string;
      dpp_factor: string;
      decimal_places: number;
      rounding: string;
      effective_from: string;
      effective_to: string;
    },
    key: string,
  ) {
    return transactionCommand(c, a, "tax-rules/create", key, i, async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${c}::uuid FOR UPDATE`;
      const from = new Date(i.effective_from),
        to = new Date(i.effective_to),
        rate = new Prisma.Decimal(i.rate),
        factor = new Prisma.Decimal(i.dpp_factor);
      if (to <= from || rate.gt(1) || factor.lte(0))
        throw new ConflictException("TAX_POLICY_INVALID");
      if (
        !(await tx.customer.findFirst({
          where: { id: i.customer_id, companyId: c, state: "ACTIVE" },
        })) ||
        !(await tx.product.findFirst({
          where: { id: i.product_id, companyId: c, state: "ACTIVE" },
        }))
      )
        throw new NotFoundException();
      if (
        await tx.salesTaxRule.count({
          where: {
            companyId: c,
            customerId: i.customer_id,
            productId: i.product_id,
            effectiveFrom: { lt: to },
            effectiveTo: { gt: from },
          },
        })
      )
        throw new ConflictException("TAX_POLICY_OVERLAP");
      const rule = await tx.salesTaxRule.create({
        data: {
          companyId: c,
          customerId: i.customer_id,
          productId: i.product_id,
          name: i.name,
          legalReference: i.legal_reference,
          taxableEvent: i.taxable_event ?? "POD",
          rate,
          dppFactor: factor,
          decimalPlaces: i.decimal_places,
          rounding: i.rounding,
          effectiveFrom: from,
          effectiveTo: to,
          createdById: a,
        },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "sales_tax_rule.created",
        resourceType: "sales_tax_rule",
        resourceId: rule.id,
        after: rule,
      });
      return rule;
    });
  }
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
        tax_rule_id?: string;
      };
      const freight = input.freight ?? {
        amount: order.freightEstimate?.toString() ?? "0",
        tax_mode: terms.tax_mode ?? "NON_TAXABLE",
        tax_rule_id: terms.tax_rule_id,
      };
      const amount = new Prisma.Decimal(freight.amount);
      if (amount.lt(0)) throw new ConflictException("FREIGHT_AMOUNT_INVALID");
      let taxAmount = new Prisma.Decimal(0);
      let taxSnapshot: Prisma.JsonValue | null = null;
      if (freight.tax_mode === "TAXABLE") {
        const rule = await tx.salesTaxRule.findFirst({
          where: {
            ...(freight.tax_rule_id ? { id: freight.tax_rule_id } : {}),
            companyId: c,
            customerId: order.customerId,
            state: "ACTIVE",
            effectiveFrom: { lte: new Date() },
            effectiveTo: { gt: new Date() },
          },
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        });
        if (!rule) throw new ConflictException("FREIGHT_TAX_RULE_INVALID");
        const rounding = (
          {
            HALF_UP: Prisma.Decimal.ROUND_HALF_UP,
            HALF_EVEN: Prisma.Decimal.ROUND_HALF_EVEN,
            DOWN: Prisma.Decimal.ROUND_DOWN,
          } as Record<string, Prisma.Decimal.Rounding>
        )[rule.rounding];
        if (rounding === undefined) throw new ConflictException("FREIGHT_TAX_ROUNDING_REQUIRED");
        const dpp = amount.mul(rule.dppFactor).toDecimalPlaces(rule.decimalPlaces, rounding);
        taxAmount = dpp.mul(rule.rate).toDecimalPlaces(rule.decimalPlaces, rounding);
        taxSnapshot = {
          rule_id: rule.id,
          name: rule.name,
          legal_reference: rule.legalReference,
          rate: rule.rate.toString(),
          dpp_factor: rule.dppFactor.toString(),
          decimal_places: rule.decimalPlaces,
          rounding: rule.rounding,
          taxable_event: rule.taxableEvent,
        };
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
      return { rows: combined.slice(skip, skip + 25), total: combined.length };
    }
    if (kind === "orders") {
      const where: Prisma.SalesOrderWhereInput = {
        companyId: c,
        ...(state ? { state } : {}),
        OR: [{ number: query }, { customer: { name: query } }],
      };
      const [rows, total] = await prisma.$transaction([
        prisma.salesOrder.findMany({
          where,
          skip,
          take: 25,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          select: {
            id: true,
            number: true,
            state: true,
            currency: true,
            createdAt: true,
            customer: { select: { name: true } },
            lines: {
              include: {
                allocations: {
                  select: {
                    acceptedQuantity: true,
                    inTransitQuantity: true,
                    returnedQuantity: true,
                  },
                },
              },
            },
          },
        }),
        prisma.salesOrder.count({ where }),
      ]);
      const [open, partial, backorder] = await prisma.$transaction([
        prisma.salesOrder.count({ where: { companyId: c, state: "OPEN" } }),
        prisma.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*)::integer AS count FROM sales_orders o
          WHERE o.company_id=${c}::uuid
          AND (SELECT COALESCE(SUM(a.accepted_quantity+a.in_transit_quantity+a.returned_quantity),0)
            FROM fulfillment_allocations a JOIN sales_order_lines l ON l.id=a.sales_order_line_id WHERE l.sales_order_id=o.id)>0
          AND (SELECT COALESCE(SUM(a.accepted_quantity+a.in_transit_quantity+a.returned_quantity),0)
            FROM fulfillment_allocations a JOIN sales_order_lines l ON l.id=a.sales_order_line_id WHERE l.sales_order_id=o.id)
            < (SELECT COALESCE(SUM(l.ordered_quantity),0) FROM sales_order_lines l WHERE l.sales_order_id=o.id)`,
        prisma.salesOrder.count({
          where: { companyId: c, state: "OPEN", lines: { some: { backorderQuantity: { gt: 0 } } } },
        }),
      ]);
      return {
        rows: rows.map(({ lines, ...row }) => ({ ...row, ...orderView({ ...row, lines }) })),
        total,
        pageSize: 25,
        summary: { open, partial: partial[0]?.count ?? 0, creditHold: null, backorder },
        asOf: new Date().toISOString(),
      };
    }
    if (kind === "warehouse") {
      const where = { companyId: c, number: query };
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
    const where = { companyId: c, number: query };
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
    const taxDocuments = await prisma.officialTaxDocument.findMany({
      where: { companyId: c, sourceType: "SALES_INVOICE", sourceId: { in: rows.map((r) => r.id) } },
      select: { sourceId: true, state: true },
    });
    const withholding = await prisma.receiptTaxComponent.findMany({
      where: {
        companyId: c,
        invoiceId: { in: rows.map((r) => r.id) },
        kind: "income_tax_withheld",
      },
      select: { invoiceId: true, state: true },
    });
    const taxByInvoice = new Map(taxDocuments.map((d) => [d.sourceId, d.state]));
    const withholdingByInvoice = new Map(withholding.map((d) => [d.invoiceId, d.state]));
    return {
      rows: rows.map((invoice) => {
        const outstanding = invoice.outstandingAmount.toString();
        const totalAmount = (invoice.total ?? invoice.subtotal.add(invoice.taxAmount)).toString();
        const taxReported = taxByInvoice.get(invoice.id);
        const notes = [] as string[];
        if (invoice.state === "POSTED" && invoice.outstandingAmount.eq(0))
          notes.push("Sudah Lunas");
        else if (
          invoice.state === "POSTED" &&
          invoice.outstandingAmount.lt(invoice.total ?? invoice.subtotal)
        )
          notes.push("DPP Lunas");
        if (invoice.taxAmount.gt(0) && !taxReported) notes.push("PPN keluaran belum dilaporkan");
        if (
          withholdingByInvoice.get(invoice.id) &&
          withholdingByInvoice.get(invoice.id) !== "VERIFIED"
        )
          notes.push("SSP belum di collect");
        return {
          ...invoice,
          subtotal: invoice.subtotal.toString(),
          taxAmount: invoice.taxAmount.toString(),
          total: totalAmount,
          outstandingAmount: outstanding,
          freightAmount: invoice.freightAmount.toString(),
          freightTaxAmount: invoice.freightTaxAmount.toString(),
          dueDate: invoice.dueDate?.toISOString() ?? null,
          createdAt: invoice.createdAt.toISOString(),
          postedAt: invoice.postedAt?.toISOString() ?? null,
          description: notes.length ? notes.join(" · ") : "Belum terverifikasi",
        };
      }),
      total,
    };
  }
  async proforma(c: string, id: string) {
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
    return { ...document, batch, status: await proformaStatus(c, document) };
  }
  async order(c: string, id: string) {
    const row = await prisma.salesOrder.findFirst({
      where: { companyId: c, id },
      include: {
        customer: { select: { name: true } },
        lines: {
          include: {
            product: { select: { code: true, name: true, baseUom: { select: { name: true } } } },
            allocations: {
              select: { acceptedQuantity: true, inTransitQuantity: true, returnedQuantity: true },
            },
          },
        },
        fulfillments: { include: { pickList: { select: { id: true, state: true } } } },
      },
    });
    if (!row) throw new NotFoundException();
    const documents = await prisma.fulfillmentDocument.findMany({
      where: {
        companyId: c,
        batchId: { in: row.fulfillments.map((b) => b.id) },
        kind: proformaKinds,
      },
      select: { id: true, kind: true, number: true, batchId: true, snapshot: true, issuedAt: true },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    });
    const view = orderView(row);
    const creator = await prisma.user.findUnique({
      where: { id: row.createdById },
      select: { displayName: true },
    });
    return {
      ...row,
      ...view,
      lines: row.lines.map((line, index) => ({ ...line, ...view.lineValues[index] })),
      createdByName: creator?.displayName ?? null,
      freightEstimate: row.freightEstimate?.toString() ?? null,
      freightTermsSnapshot: row.freightTermsSnapshot,
      documents: await Promise.all(
        documents.map(async ({ snapshot, ...document }) => ({
          ...document,
          status: await proformaStatus(c, { ...document, snapshot }),
        })),
      ),
    };
  }
  async batch(c: string, id: string) {
    const row = await prisma.fulfillmentBatch.findFirst({
      where: { companyId: c, id },
      include: {
        salesOrder: {
          select: {
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
              select: { batchNo: true, expiryDate: true, product: { select: { name: true } } },
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
      select: { id: true, kind: true, number: true, issuedAt: true },
    });
    const freightTaxRules = await prisma.salesTaxRule.findMany({
      where: {
        companyId: c,
        customerId: row.salesOrder.customerId,
        state: "ACTIVE",
        effectiveFrom: { lte: new Date() },
        effectiveTo: { gt: new Date() },
      },
      select: { id: true, name: true, rate: true },
      orderBy: { name: "asc" },
      take: 250,
    });
    return { ...row, documents, freightTaxRules };
  }
  async invoice(c: string, id: string) {
    const row = await prisma.salesInvoice.findFirst({
      where: { companyId: c, id },
      include: {
        customer: { select: { name: true } },
        salesOrder: { select: { number: true, deliveryAddress: true } },
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
        receiptAllocations: true,
      },
    });
    if (!row) throw new NotFoundException();
    const receipts = await prisma.customerReceipt.findMany({
      where: { companyId: c, customerId: row.customerId },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
    const document = await prisma.fulfillmentDocument.findFirst({
      where: { companyId: c, kind: `INVOICE:${id}` },
    });
    return { ...row, receipts, document };
  }
  async lookups(c: string) {
    const [customers, products, taxRules] = await Promise.all([
      prisma.customer.findMany({
        where: { companyId: c, state: "ACTIVE" },
        select: {
          id: true,
          name: true,
          shippingAddress: true,
          primaryAddress: true,
          paymentPolicies: {
            where: { active: true, effectiveFrom: { lte: new Date() } },
            orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "asc" }],
            take: 1,
            select: { mode: true, topDays: true },
          },
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
      prisma.salesTaxRule.findMany({
        where: {
          companyId: c,
          state: "ACTIVE",
          effectiveFrom: { lte: new Date() },
          effectiveTo: { gt: new Date() },
        },
        select: { id: true, name: true, rate: true },
        orderBy: { name: "asc" },
        take: 250,
      }),
    ]);
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: c },
      select: { baseCurrency: true, timezone: true },
    });
    return {
      customers,
      products,
      taxRules,
      currency: company.baseCurrency,
      timezone: company.timezone,
    };
  }
}
