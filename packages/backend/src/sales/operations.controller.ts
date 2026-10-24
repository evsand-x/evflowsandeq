import {
  RequireResourcePermission,
  resourcePermissionCode,
} from "../identity/resource-permissions";
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Headers,
  Req,
  Inject,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { prisma } from "@evflow/database";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { OperationsService } from "./operations.service";
import { previewProforma } from "./proforma";
import { orderListFilterSchema } from "./order-list-filters";
import { requestException, decideException, manageException } from "./exception-controls";
import { OtcPtpService } from "../otc-ptp.service";
import { processExceptionEvaluations } from "./exception-evaluation";
import { isAccessAdministrator, shipmentSchema } from "@evflow/contracts";
import { outboundList, returnList, returnDetail, returnSources } from "./outbound-read";
import { listHandoffs, saveHandoff } from "./commercial-handoff";

const uuid = (v: string) => z.string().uuid().parse(v);
const key = (v?: string) => {
  if (!v || v.length < 8 || v.length > 200)
    throw new BadRequestException("Idempotency-Key wajib (8–200 karakter).");
  return v;
};
const readPermission: Record<string, string> = {
  PROFORMA_HANDOFF: "proforma.issue",
  PRODUCT_MASTER: "master_product.read",
  INVOICE_HANDOFF: "sales_invoice.read",
  WAREHOUSE_CONTROL: "outbound_checking.read",
  SALES_ORDER: "sales_order.read",
  POD: "delivery_receipt.read",
  PAYMENT: "customer_receipt.read",
  TAX: "tax_component.read",
  TAX_OUTPUT: "tax_output.read",
  TAX_INPUT: "tax_input.read",
};
const writePermission: Record<string, string> = {
  PROFORMA_HANDOFF: "proforma.issue",
  PRODUCT_MASTER: "master_product.update",
  INVOICE_HANDOFF: "sales_invoice.post",
  WAREHOUSE_CONTROL: "fulfillment.check",
  SALES_ORDER: "sales_order.create",
  POD: "delivery_receipt.confirm",
  PAYMENT: "customer_receipt.post",
  TAX: "tax_component.create",
  TAX_OUTPUT: "tax_output.update",
  TAX_INPUT: "tax_input.update",
};
function allowed(req: AuthenticatedRequest, permission: string) {
  if (!hasPermission(req, permission)) throw new ForbiddenException();
}
function allowedAny(req: AuthenticatedRequest, permissions: string[]) {
  if (!permissions.some((permission) => hasPermission(req, permission)))
    throw new ForbiddenException();
}
function hasPermission(req: AuthenticatedRequest, permission: string) {
  return (
    isAccessAdministrator(req.auth) ||
    req.auth.permissions.some(
      (p) =>
        p.code === permission &&
        ["company", "privileged"].includes(p.scope_type) &&
        (!p.scope_id || p.scope_id === req.auth.company_id),
    )
  );
}
@Controller("operations")
@UseGuards(AuthGuard, PermissionGuard)
export class OperationsController {
  constructor(
    @Inject(OperationsService) private readonly service: OperationsService,
    @Inject(OtcPtpService) private readonly otc: OtcPtpService,
  ) {}
  @Get("fulfillment-batches/:id/proforma-preview")
  @RequirePermissions("proforma.issue")
  async previewProforma(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: await previewProforma(req.auth.company_id, uuid(id)) };
  }
  @Post("fulfillment-batches/:id/proforma-preview")
  @RequirePermissions("proforma.issue")
  async previewProformaFreight(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await previewProforma(req.auth.company_id, uuid(id), body) };
  }
  @Get("warehouse-backorders")
  @RequirePermissions("warehouse_allocation.read")
  async warehouseBackorders(@Query() query: unknown, @Req() req: AuthenticatedRequest) {
    return this.backorders(query, req);
  }
  @Get("backorders")
  @RequirePermissions("sales_backorder.read")
  async backorders(@Query() query: unknown, @Req() req: AuthenticatedRequest) {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        search: z.string().max(100).default(""),
      })
      .strict()
      .parse(query);
    const where = {
      companyId: req.auth.company_id,
      backorderQuantity: { gt: 0 },
      salesOrder: {
        state: "OPEN" as const,
        OR: [
          { number: { contains: q.search, mode: "insensitive" as const } },
          { customer: { name: { contains: q.search, mode: "insensitive" as const } } },
        ],
      },
    };
    const [rows, total] = await prisma.$transaction([
      prisma.salesOrderLine.findMany({
        where,
        skip: (q.page - 1) * 25,
        take: 25,
        orderBy: { id: "asc" },
        select: {
          id: true,
          orderedQuantity: true,
          backorderQuantity: true,
          product: { select: { name: true } },
          salesOrder: {
            select: { id: true, number: true, version: true, customer: { select: { name: true } } },
          },
        },
      }),
      prisma.salesOrderLine.count({ where }),
    ]);
    return { data: { rows, total } };
  }
  @Get("orders/:id/exceptions")
  @RequirePermissions("sales_order.read")
  async exceptions(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const rows = await prisma.salesExceptionRequest.findMany({
      where: { companyId: req.auth.company_id, salesOrderId: uuid(id) },
      orderBy: { createdAt: "desc" },
    });
    const actions = await prisma.transactionApprovalAction.findMany({
      where: { companyId: req.auth.company_id, sourceId: { in: rows.map((r) => r.id) } },
      orderBy: { createdAt: "asc" },
    });
    const evaluations = await prisma.$queryRaw<
      { id: string; state: string; last_error: string | null }[]
    >`
      SELECT id, state, last_error FROM sales_exception_evaluations
      WHERE company_id=${req.auth.company_id}::uuid AND sales_order_id=${id}::uuid`;
    return {
      data: rows.map((r) => ({
        ...r,
        actions: actions.filter((a) => a.sourceId === r.id),
        evaluation: evaluations.find((e) => e.id === r.id),
      })),
    };
  }
  @Post("orders/:id/exceptions")
  async requestException(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = z
      .object({
        kind: z.enum(["SALES_ORDER_UNLOCK", "SPECIAL_PRICE"]),
        version: z.number().int().positive(),
        line_id: z.string().uuid().optional(),
        reasons: z
          .array(z.enum(["CREDIT_HOLD", "CUSTOMER_PAST_DUE", "CUSTOMER_CREDIT_FROZEN"]))
          .max(3),
        reason: z.string().trim().min(1).max(1000),
        evidence_id: z.string().uuid(),
        amount_limit: z.string().regex(/^\d+(\.\d{1,8})?$/),
      })
      .strict()
      .parse(body);
    allowed(
      req,
      input.kind === "SPECIAL_PRICE" ? "price_request.submit" : "sales_order.unlock.request",
    );
    return {
      data: await requestException(req.auth.company_id, req.auth.user_id, uuid(id), input, key(k)),
    };
  }
  @Post("exceptions/:id/decisions")
  async decide(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = z
      .object({
        decision: z.enum(["APPROVED", "REJECTED", "REVISION_REQUIRED"]),
        reason: z.string().trim().min(1).max(1000),
      })
      .strict()
      .parse(body);
    const ref = await prisma.salesExceptionRequest.findFirst({
      where: { companyId: req.auth.company_id, id: uuid(id) },
    });
    if (!ref) throw new NotFoundException();
    allowed(
      req,
      ref.kind === "SPECIAL_PRICE" ? "price_request.approve" : "sales_order.unlock.approve",
    );
    const decision = await decideException(
      req.auth.company_id,
      req.auth.user_id,
      id,
      input,
      key(k),
    );
    if (decision.state !== "APPROVED") return { data: decision };
    const evaluation = await processExceptionEvaluations(req.auth.company_id, decision.id);
    return {
      data: {
        ...decision,
        evaluation,
        ...(evaluation?.state !== "COMPLETED"
          ? {
              evaluation_error:
                evaluation?.last_error ?? "Evaluasi dijadwalkan; periksa kembali status SO.",
            }
          : {}),
      },
    };
  }
  @Post("exceptions/:id/manage")
  async manage(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = z
      .object({
        action: z.enum(["CANCEL", "DELEGATE"]),
        reason: z.string().trim().min(1).max(1000),
        delegate_id: z.string().uuid().optional(),
      })
      .strict()
      .parse(body);
    const ref = await prisma.salesExceptionRequest.findFirst({
      where: { companyId: req.auth.company_id, id: uuid(id) },
    });
    if (!ref) throw new NotFoundException();
    allowed(
      req,
      ref.kind === "SPECIAL_PRICE"
        ? input.action === "CANCEL"
          ? "price_request.submit"
          : "price_request.approve"
        : input.action === "CANCEL"
          ? "sales_order.unlock.request"
          : "sales_order.unlock.approve",
    );
    return {
      data: await manageException(req.auth.company_id, req.auth.user_id, id, input, key(k)),
    };
  }
  @Get("warehouse/:id/funding")
  @RequirePermissions("customer_receipt.read")
  async funding(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const batch = await prisma.fulfillmentBatch.findFirst({
      where: { id: uuid(id), companyId: req.auth.company_id },
      include: {
        salesOrder: {
          select: { id: true, customerId: true, currency: true, paymentSnapshot: true },
        },
        customerReceipts: {
          where: { state: "POSTED" },
          select: {
            id: true,
            amount: true,
            unallocatedAmount: true,
            currency: true,
            bankReference: true,
            receivedAt: true,
          },
        },
      },
    });
    if (!batch) throw new NotFoundException();
    return { data: batch };
  }
  @Post("orders/:id/reallocate")
  @RequirePermissions("sales_order.reallocate")
  async reallocate(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = z.object({ version: z.number().int().positive() }).strict().parse(body);
    return {
      data: await this.otc.submitSalesOrder(
        req.auth.company_id,
        req.auth.user_id,
        uuid(id),
        key(k),
        input.version,
      ),
    };
  }
  @Post("evidence")
  async upload(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const i = z
      .object({
        purpose: z.enum([
          "CUSTOMER_MASTER",
          "PRODUCT_MASTER",
          "SALES_ORDER",
          "POD",
          "PAYMENT",
          "TAX",
          "TAX_OUTPUT",
          "TAX_INPUT",
          "WAREHOUSE_CONTROL",
          "PROFORMA_HANDOFF",
          "INVOICE_HANDOFF",
        ]),
        name: z.string().min(1).max(200),
        base64: z
          .string()
          .min(1)
          .max(2800000)
          .regex(/^[A-Za-z0-9+/]*={0,2}$/),
      })
      .strict()
      .parse(body);
    if (i.purpose === "CUSTOMER_MASTER")
      allowedAny(req, ["master_customer.create", "master_customer.update"]);
    else allowed(req, writePermission[i.purpose]!);
    return {
      data: await this.service.upload(
        req.auth.company_id,
        req.auth.user_id,
        i.purpose,
        i.name,
        i.base64,
      ),
    };
  }
  @Get("evidence/:id")
  async evidence(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const metadata = await prisma.transactionEvidence.findFirst({
      where: { companyId: req.auth.company_id, id: uuid(id) },
    });
    if (!metadata) throw new NotFoundException();
    if (metadata.purpose === "CUSTOMER_MASTER") allowed(req, "master_customer.read");
    else if (metadata.purpose === "PROFORMA_HANDOFF") allowed(req, "proforma.read");
    else if (
      metadata.purpose === "TAX" &&
      hasPermission(req, "tax_output.read") &&
      (await prisma.officialTaxDocument.findFirst({
        where: {
          companyId: req.auth.company_id,
          evidenceId: metadata.id,
          sourceType: "SALES_INVOICE",
        },
      }))
    ) {
      /* Legacy output attachment remains scoped to its document. */
    } else allowed(req, readPermission[metadata.purpose]!);
    return { data: await this.service.evidence(req.auth.company_id, id) };
  }
  @Get("commercial-handoffs/:kind/:id")
  async handoffs(
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const k = z.enum(["proforma", "invoice"]).parse(kind);
    if (k === "invoice") allowed(req, "sales_invoice.read");
    else allowed(req, "proforma.read");
    return { data: await listHandoffs(req.auth.company_id, k, uuid(id)) };
  }
  @Post("commercial-handoffs/:kind/:id")
  async handoff(
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") replay: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const k = z.enum(["proforma", "invoice"]).parse(kind);
    allowed(req, k === "invoice" ? "sales_invoice.post" : "proforma.issue");
    return {
      data: await saveHandoff(
        req.auth.company_id,
        req.auth.user_id,
        k,
        uuid(id),
        body,
        key(replay),
      ),
    };
  }
  @Get("lookups")
  @RequirePermissions("sales_order.create")
  async lookups(@Req() req: AuthenticatedRequest) {
    return { data: await this.service.lookups(req.auth.company_id) };
  }
  @Get("order-options")
  async orderOptions(@Req() req: AuthenticatedRequest) {
    const canCreate =
      isAccessAdministrator(req.auth) ||
      req.auth.permissions.some(
        (p) =>
          p.code === "sales_order.create" &&
          ["company", "privileged"].includes(p.scope_type) &&
          (!p.scope_id || p.scope_id === req.auth.company_id),
      );
    allowed(req, canCreate ? "sales_order.create" : "sales_order.update");
    return { data: await this.service.lookups(req.auth.company_id) };
  }
  @Get("control-options/:kind")
  async controlOptions(@Param("kind") kind: string, @Req() req: AuthenticatedRequest) {
    const type = z.enum(["credit", "approval", "quality"]).parse(kind);
    allowed(
      req,
      {
        credit: "customer.payment_policy.manage",
        approval: "transaction_approval.manage",
        quality: "inventory.quality.decide",
      }[type],
    );
    const c = req.auth.company_id;
    if (type === "approval")
      return {
        data: {
          users: await prisma.companyMembership.findMany({
            where: { companyId: c, active: true, user: { active: true } },
            select: { user: { select: { id: true, displayName: true } } },
            take: 250,
          }),
        },
      };
    if (type === "quality")
      return {
        data: {
          lots: await prisma.stockLot.findMany({
            where: { companyId: c },
            select: {
              id: true,
              batchNo: true,
              qualityState: true,
              quantityOnHand: true,
              expiryDate: true,
              product: { select: { name: true } },
              locator: { select: { name: true } },
            },
            take: 250,
            orderBy: { createdAt: "desc" },
          }),
        },
      };
    return { data: await this.service.lookups(c) };
  }
  @Post("approval-policies")
  @RequirePermissions("transaction_approval.manage")
  async approval(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
    @Headers("idempotency-key") k: string | undefined,
  ) {
    const i = z
      .object({
        currency: z.string().regex(/^[A-Z]{3}$/),
        document_kind: z
          .enum([
            "PURCHASE_REQUEST",
            "SALES_ORDER_UNLOCK",
            "SPECIAL_PRICE",
            "BANK_TRANSACTION",
            "TAX_CORRECTION",
            "CUSTOMER_REFUND",
            "SOURCE_REVERSAL",
            "FINANCE_CLOSE",
            "TAX_RULE_CHANGE",
            "ADVANCE_REFUND",
          ])
          .optional(),
        allowed_reasons: z
          .array(z.enum(["CREDIT_HOLD", "CUSTOMER_PAST_DUE", "CUSTOMER_CREDIT_FROZEN"]))
          .max(3)
          .optional(),
        grant_hours: z.number().int().min(1).max(8760).optional(),
        maximum_amount: z.string().regex(/^\d+(\.\d{1,8})?$/),
        steps: z
          .array(
            z
              .object({
                mode: z.enum(["ANY", "ALL"]),
                user_ids: z.array(z.string().uuid()).min(1).max(20),
              })
              .strict(),
          )
          .min(1)
          .max(10),
        effective_from: z.string().datetime(),
        effective_to: z.string().datetime(),
      })
      .strict()
      .parse(body);
    return {
      data: await this.service.approvalPolicy(req.auth.company_id, req.auth.user_id, i, key(k)),
    };
  }
  @Get("outbound/:stage")
  @RequireResourcePermission("outbound", "read", "params", "stage")
  async outbound(
    @Param("stage") stage: string,
    @Query() query: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const s = z.enum(["picking", "checking", "shipping", "pod"]).parse(stage);
    const q = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        search: z.string().max(100).default(""),
        status: z.string().max(80).default(""),
      })
      .strict()
      .parse(query);
    return { data: await outboundList(req.auth.company_id, s, q.page, q.search, q.status) };
  }
  @Get("outbound/:stage/:id")
  @RequireResourcePermission("outbound", "read", "params", "stage")
  async outboundDetail(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: await this.service.batch(req.auth.company_id, uuid(id)) };
  }
  @Get("returns")
  @RequirePermissions("customer_return.receive")
  async returns(@Query() query: unknown, @Req() req: AuthenticatedRequest) {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        search: z.string().max(100).default(""),
      })
      .strict()
      .parse(query);
    return { data: await returnList(req.auth.company_id, q.page, q.search) };
  }
  @Get("return-sources")
  @RequirePermissions("customer_return.receive")
  async returnSources(@Req() req: AuthenticatedRequest) {
    return { data: await returnSources(req.auth.company_id) };
  }
  @Get("returns/:id")
  @RequirePermissions("customer_return.receive")
  async returnDetail(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: await returnDetail(req.auth.company_id, uuid(id)) };
  }
  @Get("lists/:kind")
  async list(
    @Param("kind") kind: string,
    @Query() query: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const type = z.enum(["orders", "warehouse", "pick-slips", "invoices", "proformas"]).parse(kind);
    if (type === "proformas") allowed(req, "proforma.read");
    else
      allowed(
        req,
        {
          orders: "sales_order.read",
          warehouse: resourcePermissionCode(
            { family: "outbound", action: "read", source: "query", key: "stage" },
            (query as { stage?: string }).stage ?? "checking",
          ),
          "pick-slips": "outbound_picking.read",
          invoices: "sales_invoice.read",
        }[type],
      );
    const q = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        search: z.string().max(100).default(""),
        state: z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]).optional(),
        stage: z.enum(["checking", "shipping", "pod"]).optional(),
        view: z
          .enum([
            "ALL",
            "ISSUED",
            "REVISION_REQUIRED",
            "SUPERSEDED",
            "PENDING",
            "UNPAID",
            "PARTIAL",
            "PAID",
            "OVERDUE",
            "HANDOFF",
          ])
          .optional(),
        customer_id: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        fulfillment: z.string().optional(),
        remainder: z.string().optional(),
      })
      .strict()
      .parse(query);
    const { customer_id, from, to, fulfillment, remainder, ...base } = q;
    // Filter pelanggan/periode/pemenuhan/sisa hanya berlaku untuk daftar Sales Order.
    const orderFilters =
      type === "orders"
        ? orderListFilterSchema.parse({ customer_id, from, to, fulfillment, remainder })
        : undefined;
    return {
      data: await (orderFilters
        ? this.service.list(
            req.auth.company_id,
            type,
            base.page,
            base.search,
            base.state,
            base.stage,
            base.view,
            orderFilters,
          )
        : this.service.list(
            req.auth.company_id,
            type,
            base.page,
            base.search,
            base.state,
            base.stage,
            base.view,
          )),
    };
  }
  @Get("proformas/:id")
  async proforma(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    allowed(req, "proforma.read");
    return {
      data: await this.service.proforma(
        req.auth.company_id,
        uuid(id),
        hasPermission(req, "customer_receipt.read"),
      ),
    };
  }
  @Get("orders/:id")
  @RequirePermissions("sales_order.read")
  async order(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: await this.service.order(req.auth.company_id, uuid(id)) };
  }
  @Get("warehouse/:id")
  @RequirePermissions("outbound_checking.read")
  async batch(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: await this.service.batch(req.auth.company_id, uuid(id)) };
  }
  @Get("invoices/:id")
  @RequirePermissions("sales_invoice.read", "customer_receipt.read")
  async invoice(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: await this.service.invoice(req.auth.company_id, uuid(id)) };
  }
  @Post("warehouse/:id/shipment")
  @RequirePermissions("fulfillment.dispatch")
  async shipment(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const i = shipmentSchema.parse(body);
    return {
      data: await this.service.shipment(req.auth.company_id, req.auth.user_id, uuid(id), i, key(k)),
    };
  }
  @Post("stock/:id/quality")
  @RequirePermissions("inventory.quality.decide")
  async quality(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const i = z
      .object({
        state: z.enum(["AVAILABLE", "HOLD", "RECALL", "QUARANTINE"]),
        reason: z.string().trim().min(1).max(1000),
      })
      .strict()
      .parse(body);
    return {
      data: await this.service.quality(req.auth.company_id, req.auth.user_id, uuid(id), i, key(k)),
    };
  }
  @Get("documents/:id")
  async document(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const row = await prisma.fulfillmentDocument.findFirst({
      where: { id: uuid(id), companyId: req.auth.company_id },
    });
    if (!row) throw new NotFoundException();
    allowed(
      req,
      row.kind.startsWith("INVOICE")
        ? "sales_invoice.read"
        : row.kind.startsWith("PROFORMA")
          ? "proforma.read"
          : row.kind.startsWith("PICK")
            ? "outbound_picking.read"
            : row.kind.startsWith("PACK")
              ? "outbound_checking.read"
              : "outbound_shipping.read",
    );
    return { data: row };
  }
  @Get("audit/:id")
  @RequirePermissions("audit_event.read")
  async audit(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return {
      data: await prisma.auditEvent.findMany({
        where: { companyId: req.auth.company_id, resourceId: uuid(id) },
        select: {
          id: true,
          action: true,
          actorId: true,
          occurredAt: true,
          beforeHash: true,
          afterHash: true,
        },
        orderBy: { occurredAt: "asc" },
        take: 200,
      }),
    };
  }
}
