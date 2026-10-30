import {
  BadRequestException,
  Body,
  ForbiddenException,
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
import { idempotencySchema, isAccessAdministrator } from "@evflow/contracts";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import {
  createDeliveryNote,
  deliveryNoteView,
  getDeliveryNote,
  getOrderDeliveryProgress,
  issueDeliveryNote,
  receiveDeliveryNote,
  updateDeliveryNoteDraft,
} from "./delivery-note";
import { deliveryNoteList, deliveryNoteTabSchema } from "./delivery-note-list";
import { deliveryNoteForm } from "./delivery-note-form";

const uuid = (id: string) => z.string().uuid().parse(id);
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
function key(value: string | undefined) {
  if (!value) throw new BadRequestException("Idempotency-Key wajib diisi.");
  return idempotencySchema.parse(value);
}
@Controller("delivery-notes")
@UseGuards(AuthGuard, PermissionGuard)
export class DeliveryNoteController {
  @Get("orders/:orderId/delivered")
  @RequirePermissions("outbound_shipping.read")
  async delivered(@Param("orderId") orderId: string, @Req() r: AuthenticatedRequest) {
    return { data: await getOrderDeliveryProgress(r.auth.company_id, uuid(orderId)) };
  }
  @Get()
  @RequirePermissions("outbound_shipping.read")
  async list(
    @Query("page") page = "1",
    @Query("search") search = "",
    @Query("state") state: string | undefined,
    @Query("tab") tab: string | undefined,
    @Query("warehouse_id") warehouseId: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    // Invoice column, invoice tabs and their counts are invoice data: sales_invoice.read only.
    const billing = hasPermission(r, "sales_invoice.read");
    const parsedTab = deliveryNoteTabSchema.default("ALL").parse(tab || undefined);
    if (!billing && (parsedTab === "UNINVOICED" || parsedTab === "INVOICED"))
      throw new ForbiddenException();
    return {
      data: await deliveryNoteList(
        r.auth.company_id,
        {
          page: z.coerce.number().int().min(1).parse(page),
          search,
          state: z
            .enum(["DRAFT", "ISSUED"])
            .optional()
            .parse(state || undefined),
          tab: parsedTab,
          warehouseId: z
            .string()
            .uuid()
            .optional()
            .parse(warehouseId || undefined),
        },
        billing,
      ),
    };
  }
  /** Form read model: SO lines, issued/remaining quantities, stock, next number, warehouses. */
  @Get("form")
  @RequirePermissions("outbound_shipping.read")
  async form(
    @Query("sales_order_id") salesOrderId: string | undefined,
    @Query("delivery_note_id") deliveryNoteId: string | undefined,
    @Query("warehouse_id") warehouseId: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    const id = z.string().uuid().optional();
    const parsed = {
      salesOrderId: id.parse(salesOrderId || undefined),
      deliveryNoteId: id.parse(deliveryNoteId || undefined),
      warehouseId: id.parse(warehouseId || undefined),
    };
    if (!parsed.salesOrderId && !parsed.deliveryNoteId)
      throw new BadRequestException("sales_order_id atau delivery_note_id wajib diisi.");
    return { data: await deliveryNoteForm(r.auth.company_id, parsed) };
  }
  @Get(":id")
  @RequirePermissions("outbound_shipping.read")
  async get(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return { data: deliveryNoteView(await getDeliveryNote(r.auth.company_id, uuid(id))) };
  }
  @Post()
  @RequirePermissions("fulfillment.dispatch")
  async create(
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: deliveryNoteView(
        await createDeliveryNote(r.auth.company_id, r.auth.user_id, body, key(k)),
      ),
    };
  }
  @Patch(":id")
  @RequirePermissions("fulfillment.dispatch")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: deliveryNoteView(
        await updateDeliveryNoteDraft(r.auth.company_id, r.auth.user_id, uuid(id), body, key(k)),
      ),
    };
  }
  @Post(":id/issue")
  @RequirePermissions("fulfillment.dispatch")
  async issue(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: deliveryNoteView(
        await issueDeliveryNote(r.auth.company_id, r.auth.user_id, uuid(id), body, key(k)),
      ),
    };
  }
  @Post(":id/receipt")
  @RequirePermissions("fulfillment.dispatch")
  async receive(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: await receiveDeliveryNote(r.auth.company_id, r.auth.user_id, uuid(id), body, key(k)),
    };
  }
}
