import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@evflow/database";
import { OperationsService } from "../sales/operations.service";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import type { AuthenticatedRequest } from "../identity/auth.types";
import {
  completeInvoicePaymentDeductionProof,
  invoicePaymentForm,
  receiveInvoicePayment,
} from "./invoice-payment";
const uuid = (value: string) => z.string().uuid().parse(value);
function key(value: string | undefined) {
  if (!value?.trim() || value.length > 200)
    throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
  return value;
}
@Controller()
@UseGuards(AuthGuard, PermissionGuard)
export class InvoicePaymentController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Post("sales-invoices/:id/payment-evidence")
  @RequirePermissions("customer_receipt.post")
  async upload(@Req() r: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z
      .object({
        purpose: z.enum(["PAYMENT", "TAX"]),
        name: z.string().trim().min(1).max(200),
        base64: z
          .string()
          .min(1)
          .max(2800000)
          .regex(/^[A-Za-z0-9+/]*={0,2}$/),
      })
      .strict()
      .parse(body);
    const found = await prisma.$transaction((tx) =>
      tx.salesInvoice.count({
        where: { id: uuid(id), companyId: r.auth.company_id, state: "POSTED" },
      }),
    );
    if (!found) throw new NotFoundException("INVOICE_NOT_FOUND");
    return {
      data: await this.operations.upload(
        r.auth.company_id,
        r.auth.user_id,
        input.purpose,
        input.name,
        input.base64,
      ),
    };
  }

  @Get("sales-invoices/:id/payment-evidence/:evidenceId")
  @RequirePermissions("customer_receipt.read")
  async evidence(
    @Req() r: AuthenticatedRequest,
    @Param("id") id: string,
    @Param("evidenceId") evidenceId: string,
  ) {
    const c = r.auth.company_id,
      invoiceId = uuid(id),
      proofId = uuid(evidenceId);
    const attached = await prisma.$transaction(async (tx) => {
      if (!(await tx.salesInvoice.count({ where: { id: invoiceId, companyId: c } }))) return false;
      const evidence = await tx.transactionEvidence.findFirst({
        where: { id: proofId, companyId: c, purpose: { in: ["PAYMENT", "TAX"] } },
      });
      if (!evidence) return false;
      return !!(
        (await tx.customerReceiptAllocation.count({
          where: { companyId: c, invoiceId, receipt: { companyId: c, evidenceId: proofId } },
        })) ||
        (await tx.invoicePaymentDeduction.count({
          where: { companyId: c, invoiceId, evidenceId: proofId },
        }))
      );
    });
    if (!attached) throw new NotFoundException("PAYMENT_EVIDENCE_NOT_FOUND");
    return { data: await this.operations.evidence(c, proofId) };
  }
  @Get("sales-invoices/:id/payment-form")
  @RequirePermissions("customer_receipt.read", "sales_invoice.view_price")
  async form(@Req() r: AuthenticatedRequest, @Param("id") id: string) {
    return { data: await invoicePaymentForm(r.auth.company_id, uuid(id)) };
  }
  @Post("sales-invoices/:id/payments")
  @RequirePermissions("customer_receipt.post", "sales_invoice.view_price")
  async receive(
    @Req() r: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await receiveInvoicePayment(r.auth.company_id, r.auth.user_id, uuid(id), body, key(k)),
    };
  }
  @Post("invoice-payment-deductions/:id/proof")
  @RequirePermissions("customer_receipt.post", "sales_invoice.view_price")
  async proof(
    @Req() r: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await completeInvoicePaymentDeductionProof(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        body,
        key(k),
      ),
    };
  }
}
