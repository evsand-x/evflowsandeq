import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import type { AuthenticatedRequest } from "../identity/auth.types";
import {
  createDeductionType,
  deductionAccountOptions,
  listDeductionTypes,
  updateDeductionType,
} from "./deduction-types";

/** Setting > Jenis Potongan. Own permissions; no shared parent grant. */
@Controller("settings/deduction-types")
@UseGuards(AuthGuard, PermissionGuard)
export class DeductionTypesController {
  @Get()
  @RequirePermissions("deduction_type.read")
  async list(@Req() r: AuthenticatedRequest) {
    return { data: await listDeductionTypes(r.auth.company_id) };
  }

  @Get("accounts")
  @RequirePermissions("deduction_type.read")
  async accounts(@Req() r: AuthenticatedRequest) {
    return { data: await deductionAccountOptions(r.auth.company_id) };
  }

  @Post()
  @RequirePermissions("deduction_type.manage")
  async create(@Body() body: unknown, @Req() r: AuthenticatedRequest) {
    return { data: await createDeductionType(r.auth.company_id, r.auth.user_id, body) };
  }

  @Patch(":id")
  @RequirePermissions("deduction_type.manage")
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Headers("if-match") ifMatch: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    const normalized = ifMatch?.replace(/^W\//, "").replaceAll('"', "");
    const version = normalized ? Number.parseInt(normalized, 10) : Number.NaN;
    if (!Number.isInteger(version) || version < 1)
      throw new BadRequestException('Header If-Match wajib berisi versi, contoh: "1".');
    return {
      data: await updateDeductionType(r.auth.company_id, r.auth.user_id, id, version, body),
    };
  }
}
