import {
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  openingStockSchema,
  createSalesOrderSchema,
  confirmPodSchema,
  pickListCheckSchema,
  pickListConfirmSchema,
  postInvoiceSchema,
  invoiceDraftSchema,
  createSupplierInvoiceSchema,
  createCustomerReceiptSchema,
  allocateCustomerReceiptSchema,
  createCustomerReturnSchema,
  postCustomerRefundSchema,
  idempotencySchema,
} from "@evflow/contracts";
import {
  BadRequestException,
  Body,
  Get,
  Controller,
  Headers,
  Inject,
  Param,
  Query,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "./identity/auth.types";
import { AuthGuard } from "./identity/auth.guard";
import { PermissionGuard } from "./identity/permission.guard";
import { RequirePermissions } from "./identity/permissions.decorator";
import { OtcPtpService } from "./otc-ptp.service";
import { closeRemainder, releaseBatch, resolvePick, reviseOrder } from "./sales/o2c-lifecycle";
import { issueProforma } from "./sales/proforma";

const parse = <T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: unknown } },
  value: unknown,
) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error);
  return result.data as T;
};
const commandKey = (value: string | undefined) => {
  if (!value) throw new BadRequestException("Idempotency-Key wajib diisi.");
  return parse(idempotencySchema, value);
};
@Controller()
@UseGuards(AuthGuard, PermissionGuard)
export class OtcPtpController {
  constructor(@Inject(OtcPtpService) private readonly service: OtcPtpService) {}
  @Post("fulfillment-batches/:id/issue-proforma")
  @RequirePermissions("proforma.issue")
  async proforma(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: await issueProforma(req.auth.company_id, req.auth.user_id, id, body, commandKey(key)),
    };
  }
  @Post("sales-orders/:id/revise")
  @RequirePermissions("sales_order.update")
  async revise(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: await reviseOrder(r.auth.company_id, r.auth.user_id, id, body, commandKey(key)),
    };
  }
  @Post("fulfillment-batches/:id/issue-invoice")
  @RequirePermissions("sales_invoice.issue")
  async issue(
    @Param("id") id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: await this.service.issueInvoice(r.auth.company_id, r.auth.user_id, id, commandKey(key)),
    };
  }
  @Post("pick-lists/:id/resolve-shortage")
  @RequirePermissions("fulfillment.check")
  async shortage(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: await resolvePick(r.auth.company_id, r.auth.user_id, id, body, commandKey(key)),
    };
  }
  @Post("fulfillment-batches/:id/release")
  @RequirePermissions("fulfillment.release")
  async release(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: await releaseBatch(r.auth.company_id, r.auth.user_id, id, body, commandKey(key)),
    };
  }
  @Post("sales-orders/:id/close-remainder")
  @RequirePermissions("sales_order.close_remainder")
  async closeRemaining(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: await closeRemainder(r.auth.company_id, r.auth.user_id, id, body, commandKey(key)),
    };
  }
  @Get("receivables/aging")
  @RequirePermissions("receivable.read")
  aging(
    @Query("customer_id") customerId: string | undefined,
    @Query("as_of") asOf: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .getArAging(req.auth.company_id, customerId, asOf)
      .then((data) => ({ data }));
  }
  @Get("receivables/invoice-candidates")
  @RequirePermissions("sales_invoice.issue")
  invoiceCandidates(@Req() req: AuthenticatedRequest) {
    return this.service.invoiceCandidates(req.auth.company_id).then((data) => ({ data }));
  }
  @Post("customers/:id/returns")
  @RequirePermissions("customer_return.receive")
  customerReturn(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!key) throw new BadRequestException("Idempotency-Key wajib diisi.");
    parse(idempotencySchema, key);
    return this.service
      .createCustomerReturn(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(createCustomerReturnSchema, body),
        key,
      )
      .then((data) => ({ data }));
  }
  @Post("customer-returns/:id/credit-note")
  @RequirePermissions("credit_note.post")
  creditNote(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.service
      .postCreditNote(req.auth.company_id, req.auth.user_id, id)
      .then((data) => ({ data }));
  }
  @Post("customer-refunds")
  @RequirePermissions("customer_refund.post")
  refund(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!key) throw new BadRequestException("Idempotency-Key wajib diisi.");
    parse(idempotencySchema, key);
    return this.service
      .postCustomerRefund(
        req.auth.company_id,
        req.auth.user_id,
        parse(postCustomerRefundSchema, body),
        key,
      )
      .then((data) => ({ data }));
  }
  @Post("stock/opening")
  @RequirePermissions("inventory.opening.create")
  openStock(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!key) throw new BadRequestException("Idempotency-Key wajib diisi.");
    parse(idempotencySchema, key);
    return this.service
      .openStock(req.auth.company_id, req.auth.user_id, parse(openingStockSchema, body), key)
      .then((data) => ({ data }));
  }
  @Post("sales-orders")
  @RequirePermissions("sales_order.create")
  createOrder(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .createSalesOrder(
        req.auth.company_id,
        req.auth.user_id,
        parse(createSalesOrderSchema, body),
        commandKey(key),
      )
      .then((data) => ({ data }));
  }
  @Post("sales-orders/:id/submit")
  @RequirePermissions("sales_order.submit")
  submit(
    @Param("id") id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!key) throw new BadRequestException("Idempotency-Key wajib diisi.");
    parse(idempotencySchema, key);
    return this.service
      .submitSalesOrder(req.auth.company_id, req.auth.user_id, id, key)
      .then((data) => ({ data }));
  }
  @Post("fulfillment-batches/:id/dispatch")
  @RequirePermissions("fulfillment.dispatch")
  dispatch(
    @Param("id") id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .dispatch(req.auth.company_id, req.auth.user_id, id, commandKey(key))
      .then((data) => ({ data }));
  }
  @Post("fulfillment-batches/:id/create-picking")
  @RequirePermissions("fulfillment.pick")
  createPicking(
    @Param("id") id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .createPickingSlip(req.auth.company_id, req.auth.user_id, id, commandKey(key))
      .then((data) => ({ data }));
  }
  @Post("fulfillment-batches/:id/pod")
  @RequirePermissions("delivery_receipt.confirm")
  pod(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .confirmPod(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(confirmPodSchema, body),
        commandKey(key),
      )
      .then((data) => ({ data }));
  }
  @Post("pick-lists/:id/confirm-pick")
  @RequirePermissions("fulfillment.pick")
  async confirmPicking(@Param("id") id: string, @Body() body: unknown, @Headers("idempotency-key") key: string | undefined, @Req() req: AuthenticatedRequest) {
    return { data: await this.service.confirmPick(req.auth.company_id, req.auth.user_id, id, parse(pickListConfirmSchema, body), commandKey(key)) };
  }
  @Post("pick-lists/:id/save-draft")
  @RequirePermissions("fulfillment.pick")
  pick(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .confirmPick(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(pickListConfirmSchema, body),
        commandKey(key),
        true,
      )
      .then((data) => ({ data }));
  }
  @Post("pick-lists/:id/confirm-check")
  @RequirePermissions("fulfillment.check")
  check(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .confirmCheck(req.auth.company_id, req.auth.user_id, id, parse(pickListCheckSchema, body ?? {}), commandKey(key))
      .then((data) => ({ data }));
  }
  @Post("sales-invoices")
  @RequirePermissions("sales_invoice.post")
  invoice(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .postInvoice(
        req.auth.company_id,
        req.auth.user_id,
        parse(postInvoiceSchema, body).delivery_receipt_id,
        commandKey(key),
      )
      .then((data) => ({ data }));
  }
  @Post("sales-invoice-drafts")
  @RequirePermissions("sales_invoice.post")
  async createInvoiceDraft(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: await this.service.saveInvoiceDraft(
        req.auth.company_id,
        req.auth.user_id,
        undefined,
        parse(invoiceDraftSchema, body),
        commandKey(key),
      ),
    };
  }
  @Post("sales-invoice-drafts/:id")
  @RequirePermissions("sales_invoice.post")
  async editInvoiceDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: await this.service.saveInvoiceDraft(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(invoiceDraftSchema, body),
        commandKey(key),
      ),
    };
  }
  @Post("customers/:id/receipts")
  @RequirePermissions("customer_receipt.post")
  customerReceipt(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!key) throw new BadRequestException("Idempotency-Key wajib diisi.");
    parse(idempotencySchema, key);
    return this.service
      .createCustomerReceipt(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(createCustomerReceiptSchema, body),
        key,
      )
      .then((data) => ({ data }));
  }
  @Post("customer-receipts/:id/allocate")
  @RequirePermissions("customer_receipt.allocate")
  allocateCustomerReceipt(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service
      .allocateCustomerReceipt(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(allocateCustomerReceiptSchema, body),
        commandKey(key),
      )
      .then((data) => ({ data }));
  }

  @Post("purchase-requests/:id/approve")
  @RequirePermissions("purchase_request.approve")
  approvePr(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.service
      .approvePurchaseRequest(req.auth.company_id, req.auth.user_id, id)
      .then((data) => ({ data }));
  }

  @Post("purchase-requests/:id/purchase-orders")
  @RequirePermissions("purchase_order.create")
  createPo(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.service
      .createPurchaseOrder(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(createPurchaseOrderSchema, body),
      )
      .then((data) => ({ data }));
  }

  @Post("purchase-orders/:id/receive")
  @RequirePermissions("goods_receipt.post")
  receivePo(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!key) throw new BadRequestException("Idempotency-Key wajib diisi.");
    parse(idempotencySchema, key);
    return this.service
      .receivePurchaseOrder(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(receivePurchaseOrderSchema, body),
        key,
      )
      .then((data) => ({ data }));
  }
  @Post("purchase-orders/:id/supplier-invoices")
  @RequirePermissions("supplier_invoice.create")
  createSupplierInvoice(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!key) throw new BadRequestException("Idempotency-Key wajib diisi.");
    parse(idempotencySchema, key);
    return this.service
      .createSupplierInvoice(
        req.auth.company_id,
        req.auth.user_id,
        id,
        parse(createSupplierInvoiceSchema, body),
        key,
      )
      .then((data) => ({ data }));
  }
  @Post("supplier-invoices/:id/post")
  @RequirePermissions("supplier_invoice.post")
  postSupplierInvoice(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.service
      .postSupplierInvoice(req.auth.company_id, req.auth.user_id, id)
      .then((data) => ({ data }));
  }
}
