import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { generalSettingsUpdateSchema } from "@evflow/contracts";
import { prisma } from "@evflow/database";
import { activePolicyValue } from "../common/policy-value";
import { getGeneralSettings, updateGeneralSettings } from "./general-settings";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import type { AuthenticatedRequest } from "../identity/auth.types";
import {
  listNumberingSettings,
  numberingDefault,
  reviseNumbering,
} from "../common/document-number";

const key = (v?: string) => {
  if (!v || v.length < 8 || v.length > 200) throw new BadRequestException("Idempotency-Key wajib.");
  return v;
};

@Controller("settings")
@UseGuards(AuthGuard, PermissionGuard)
export class SettingsController {
  /** Display preferences every signed-in member needs; contains no restricted data. */
  @Get("preferences")
  async preferences(@Req() r: AuthenticatedRequest) {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: r.auth.company_id } });
    return {
      data: {
        company_name: company.name,
        logo_object_key: company.logoObjectKey,
        number_format: await activePolicyValue(prisma, company.id, "OPS-FLX-06"),
      },
    };
  }

  @Get("general")
  @RequirePermissions("setting_general.read")
  async general(@Req() r: AuthenticatedRequest) {
    return { data: await getGeneralSettings(r.auth.company_id) };
  }

  @Patch("general")
  @RequirePermissions("setting_general.update")
  async updateGeneral(
    @Body() body: unknown,
    @Headers("if-match") ifMatch: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    const input = generalSettingsUpdateSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    const normalized = ifMatch?.replace(/^W\//, "").replaceAll('"', "");
    const version = normalized ? Number.parseInt(normalized, 10) : Number.NaN;
    if (!Number.isInteger(version) || version < 1)
      throw new BadRequestException('Header If-Match wajib berisi versi, contoh: "1".');
    return {
      data: await updateGeneralSettings(r.auth.company_id, r.auth.user_id, version, input.data),
    };
  }

  @Get("numbering")
  @RequirePermissions("numbering_rule.read")
  async numbering(@Req() r: AuthenticatedRequest) {
    return { data: await listNumberingSettings(r.auth.company_id) };
  }

  @Put("numbering/:kind")
  @RequirePermissions("numbering_rule.manage")
  async revise(
    @Param("kind") kind: string,
    @Body() body: unknown,
    @Headers("idempotency-key") k: string | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    numberingDefault(kind);
    return {
      data: await reviseNumbering(r.auth.company_id, r.auth.user_id, kind, body, key(k)),
    };
  }
}
