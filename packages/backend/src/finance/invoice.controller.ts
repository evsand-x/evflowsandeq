import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  idempotencySchema,
  isAccessAdministrator,
  submitSalesInvoiceSchema,
} from "@evflow/contracts";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { saveInvoiceDraft, submitInvoice } from "./invoice";
import { invoiceCandidates, invoiceDetail, invoiceForm, invoiceList } from "./invoice-read";
import { invoiceWithoutPrices } from "./invoice-privacy";
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}
const uuid = (id: string) => parse(z.string().uuid(), id);
const key = (k: string | undefined) => parse(idempotencySchema, k);
function can(r: AuthenticatedRequest, code: string) {
  return (
    isAccessAdministrator(r.auth) ||
    r.auth.permissions.some(
      (p) =>
        p.code === code &&
        ["company", "privileged"].includes(p.scope_type) &&
        (!p.scope_id || p.scope_id === r.auth.company_id),
    )
  );
}
@Controller("sales-invoices")
@UseGuards(AuthGuard, PermissionGuard)
export class InvoiceController {
  @Get()
  @RequirePermissions("sales_invoice.read")
  async list(@Req() r: AuthenticatedRequest, @Query() q: unknown) {
    const data = await invoiceList(r.auth.company_id, q);
    return {
      data: can(r, "sales_invoice.view_price")
        ? data
        : { ...data, rows: data.rows.map(invoiceWithoutPrices) },
    };
  }
  @Get("candidates")
  @RequirePermissions("sales_invoice.read")
  async candidates(@Req() r: AuthenticatedRequest, @Query() q: unknown) {
    const i = parse(
      z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          search: z.string().trim().max(150).default(""),
          customer_id: z.string().uuid().optional(),
        })
        .strict(),
      q,
    );
    return {
      data: await invoiceCandidates(r.auth.company_id, {
        page: i.page ?? 1,
        search: i.search ?? "",
        ...(i.customer_id ? { customerId: i.customer_id } : {}),
      }),
    };
  }
  @Get("form")
  @RequirePermissions("sales_invoice.read", "sales_invoice.view_price")
  async form(@Req() r: AuthenticatedRequest, @Query() q: unknown) {
    const i = parse(
      z
        .object({
          surat_jalan_id: z.string().uuid().optional(),
          invoice_id: z.string().uuid().optional(),
        })
        .strict(),
      q,
    );
    return {
      data: await invoiceForm(r.auth.company_id, {
        ...(i.surat_jalan_id ? { deliveryNoteId: i.surat_jalan_id } : {}),
        ...(i.invoice_id ? { invoiceId: i.invoice_id } : {}),
      }),
    };
  }
  @Get(":id")
  @RequirePermissions("sales_invoice.read")
  async detail(@Req() r: AuthenticatedRequest, @Param("id") id: string) {
    const prices = can(r, "sales_invoice.view_price");
    const data = await invoiceDetail(
      r.auth.company_id,
      uuid(id),
      prices && can(r, "customer_receipt.read"),
    );
    return { data: prices ? data : invoiceWithoutPrices(data) };
  }
  @Post("drafts")
  @RequirePermissions("sales_invoice.post", "sales_invoice.view_price")
  async create(
    @Req() r: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
  ) {
    return { data: await saveInvoiceDraft(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Patch(":id/draft")
  @RequirePermissions("sales_invoice.post", "sales_invoice.view_price")
  async update(
    @Req() r: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
  ) {
    return {
      data: await saveInvoiceDraft(r.auth.company_id, r.auth.user_id, body, key(k), uuid(id)),
    };
  }
  @Post(":id/submit")
  @RequirePermissions("sales_invoice.post", "sales_invoice.view_price")
  async submit(
    @Req() r: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
  ) {
    const { version } = parse(submitSalesInvoiceSchema, body);
    return {
      data: await submitInvoice(r.auth.company_id, r.auth.user_id, uuid(id), version, key(k)),
    };
  }
}
