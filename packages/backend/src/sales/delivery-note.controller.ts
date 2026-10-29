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
import { idempotencySchema } from "@evflow/contracts";
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
  listDeliveryNotes,
  updateDeliveryNoteDraft,
} from "./delivery-note";

const uuid = (id: string) => z.string().uuid().parse(id);
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
    @Req() r: AuthenticatedRequest,
  ) {
    const result = await listDeliveryNotes(
      r.auth.company_id,
      z.coerce.number().int().min(1).parse(page),
      search,
      z.enum(["DRAFT", "ISSUED"]).optional().parse(state),
    );
    return { data: { ...result, rows: result.rows.map(deliveryNoteView) } };
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
}
