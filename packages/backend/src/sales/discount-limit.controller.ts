import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { discountLimitUpdateSchema, isAccessAdministrator } from "@evflow/contracts";
import { AccessAdministratorGuard } from "../identity/access-administrator.guard";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import type { AuthenticatedRequest } from "../identity/auth.types";
import {
  DISCOUNT_LIMIT_PERMISSION,
  memberDiscountLimit,
  setRoleDiscountLimit,
  setUserDiscountLimit,
} from "./discount-limit";

function parseVersion(value: string | undefined) {
  const normalized = value?.replace(/^W\//, "").replaceAll('"', "");
  const version = normalized ? Number.parseInt(normalized, 10) : Number.NaN;
  if (!Number.isInteger(version) || version < 1)
    throw new BadRequestException(
      'Header If-Match wajib berisi versi data, contoh: "1730000000000".',
    );
  return version;
}

function parseBody(body: unknown) {
  const input = discountLimitUpdateSchema.safeParse(body);
  if (!input.success) throw new BadRequestException(input.error.flatten());
  return input.data.discount_limit;
}

/** Discount limits per role and per person; the product cap is edited on the Product master. Own permission. */
@Controller("settings/discount-limit")
@UseGuards(AuthGuard, PermissionGuard)
export class DiscountLimitController {
  /** The caller's own effective limit (percent string or "UNLIMITED"); used by the Sales Order form. */
  @Get("me")
  async mine(
    @Query("product_id", new ParseUUIDPipe({ optional: true })) productId: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: {
        discount_limit: await memberDiscountLimit(r.auth, productId, isAccessAdministrator(r.auth)),
      },
    };
  }

  /** Admin Sistem only (like Pengguna/Peran): a delegated holder must not raise their own or their role's limit. */
  @Patch("roles/:id")
  @UseGuards(AccessAdministratorGuard)
  @RequirePermissions(DISCOUNT_LIMIT_PERMISSION)
  async role(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: await setRoleDiscountLimit(
        r.auth.company_id,
        r.auth.user_id,
        id,
        parseBody(body),
        parseVersion(ifMatch),
      ),
    };
  }

  @Patch("users/:id")
  @UseGuards(AccessAdministratorGuard)
  @RequirePermissions(DISCOUNT_LIMIT_PERMISSION)
  async user(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
  ) {
    return {
      data: await setUserDiscountLimit(
        r.auth.company_id,
        r.auth.user_id,
        id,
        parseBody(body),
        parseVersion(ifMatch),
      ),
    };
  }
}
