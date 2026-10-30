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
import {
  inventoryListQuerySchema,
  stockCardQuerySchema,
  createStockCountSchema,
  updateStockCountSchema,
  stockCountVersionSchema,
  idempotencySchema,
  isAccessAdministrator,
} from "@evflow/contracts";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { inventoryDetail, listInventory, stockCard } from "./inventory-read";
import {
  createStockCount,
  updateStockCount,
  submitStockCount,
  approveStockCount,
  postStockCount,
} from "./inventory-stock-count";
import { z } from "zod";

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
};
const uuid = (id: string) => parse(z.string().uuid(), id);
const key = (value: string | undefined) => parse(idempotencySchema, value);
function can(req: AuthenticatedRequest, code: string) {
  return (
    isAccessAdministrator(req.auth) ||
    req.auth.permissions.some(
      (p) =>
        p.code === code &&
        ["company", "privileged"].includes(p.scope_type) &&
        (!p.scope_id || p.scope_id === req.auth.company_id),
    )
  );
}

@Controller("inventory")
@UseGuards(AuthGuard, PermissionGuard)
export class InventoryController {
  @Get()
  @RequirePermissions("inventory.read")
  async list(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
    const q = parse(inventoryListQuerySchema, query);
    return {
      data: await listInventory(req.auth.company_id, {
        ...(q.search !== undefined ? { search: q.search } : {}),
        ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
        ...(q.category_id ? { categoryId: q.category_id } : {}),
        ...(q.low_only !== undefined ? { lowOnly: q.low_only } : {}),
        ...(q.page !== undefined ? { page: q.page } : {}),
        ...(q.page_size !== undefined ? { pageSize: q.page_size } : {}),
        includeCost: can(req, "inventory.cost.read"),
      }),
    };
  }

  @Get(":id")
  @RequirePermissions("inventory.read")
  async detail(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return {
      data: await inventoryDetail(req.auth.company_id, uuid(id), can(req, "inventory.cost.read")),
    };
  }

  @Get(":id/stock-card")
  @RequirePermissions("inventory.read")
  async card(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Query() query: unknown) {
    const q = parse(stockCardQuerySchema, query);
    return {
      data: await stockCard(req.auth.company_id, uuid(id), {
        ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
        ...(q.batch_no ? { batchNo: q.batch_no } : {}),
        from: q.from,
        to: q.to,
        includeCost: can(req, "inventory.cost.read"),
      }),
    };
  }

  @Post("stock-counts")
  @RequirePermissions("inventory.stock_count.create")
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") header: string | undefined,
  ) {
    return {
      data: await createStockCount(
        req.auth.company_id,
        req.auth.user_id,
        parse(createStockCountSchema, body),
        key(header),
      ),
    };
  }

  @Patch("stock-counts/:id")
  @RequirePermissions("inventory.stock_count.edit")
  async update(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") header: string | undefined,
  ) {
    return {
      data: await updateStockCount(
        req.auth.company_id,
        req.auth.user_id,
        uuid(id),
        parse(updateStockCountSchema, body),
        key(header),
      ),
    };
  }

  @Post("stock-counts/:id/submit")
  @RequirePermissions("inventory.stock_count.submit")
  async submit(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") header: string | undefined,
  ) {
    return {
      data: await submitStockCount(
        req.auth.company_id,
        req.auth.user_id,
        uuid(id),
        parse(stockCountVersionSchema, body),
        key(header),
      ),
    };
  }

  @Post("stock-counts/:id/approve")
  @RequirePermissions("inventory.stock_count.approve")
  async approve(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") header: string | undefined,
  ) {
    return {
      data: await approveStockCount(
        req.auth.company_id,
        req.auth.user_id,
        uuid(id),
        parse(stockCountVersionSchema, body),
        key(header),
      ),
    };
  }

  @Post("stock-counts/:id/post")
  @RequirePermissions("inventory.stock_count.post")
  async post(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") header: string | undefined,
  ) {
    return {
      data: await postStockCount(
        req.auth.company_id,
        req.auth.user_id,
        uuid(id),
        parse(stockCountVersionSchema, body),
        key(header),
      ),
    };
  }
}
