import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { prisma } from "@evflow/database";
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

async function activePolicyValue(companyId: string, code: string) {
  const version = await prisma.policyVersion.findFirst({
    where: { policy: { companyId, code }, state: "ACTIVE" },
    orderBy: { versionNo: "desc" },
  });
  return version?.valueSnapshot ?? null;
}

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
        number_format: await activePolicyValue(company.id, "OPS-FLX-06"),
      },
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
