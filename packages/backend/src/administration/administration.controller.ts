import { companyProfileUpdateSchema, policyUpdateSchema } from "@evflow/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import { AdministrationService } from "./administration.service";
import {
  assertPolicyPermission,
  readablePolicyGroups,
  type PolicyAction,
} from "./setting-permissions";

@Controller()
@UseGuards(AuthGuard, PermissionGuard)
export class AdministrationController {
  constructor(
    @Inject(AdministrationService)
    private readonly administration: AdministrationService,
  ) {}

  @Get("company-profile")
  @RequirePermissions("company_profile.read")
  async companyProfile(@Req() request: AuthenticatedRequest) {
    return { data: await this.administration.getCompanyProfile(request.auth.company_id) };
  }

  @Patch("company-profile")
  @RequirePermissions("company_profile.update")
  async updateCompanyProfile(
    @Body() body: unknown,
    @Headers("if-match") ifMatch: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = companyProfileUpdateSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.administration.updateCompanyProfile(
        request.auth.company_id,
        request.auth.user_id,
        this.parseVersion(ifMatch),
        input.data,
      ),
    };
  }

  @Get("operational-policies")
  async policies(@Req() request: AuthenticatedRequest, @Query("group") group?: string) {
    const allowed = readablePolicyGroups(request.auth);
    if (!allowed.length || (group && !allowed.includes(group))) {
      throw new ForbiddenException("Izin atau scope tidak mencukupi.");
    }
    return {
      data: await this.administration.listPolicies(request.auth.company_id, group, allowed),
    };
  }

  @Get("operational-policies/:code")
  async policy(@Param("code") code: string, @Req() request: AuthenticatedRequest) {
    await this.authorizePolicy(request, code, "read");
    return { data: await this.administration.getPolicy(request.auth.company_id, code) };
  }

  @Post("operational-policies/:code/validate")
  async validatePolicy(
    @Param("code") code: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.authorizePolicy(request, code, "update");
    const input = policyUpdateSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.administration.validatePolicy(request.auth.company_id, code, input.data),
    };
  }

  @Patch("operational-policies/:code")
  async updatePolicy(
    @Param("code") code: string,
    @Body() body: unknown,
    @Headers("if-match") ifMatch: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.authorizePolicy(request, code, "update");
    const input = policyUpdateSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.administration.updatePolicy(
        request.auth.company_id,
        request.auth.user_id,
        code,
        this.parseVersion(ifMatch),
        input.data,
      ),
    };
  }

  // Izin diperiksa per kebijakan menurut submenu pemilik kelompoknya.
  private async authorizePolicy(
    request: AuthenticatedRequest,
    code: string,
    action: PolicyAction,
  ) {
    const group = await this.administration.getPolicyGroup(request.auth.company_id, code);
    assertPolicyPermission(request.auth, group, action);
  }

  private parseVersion(ifMatch: string | undefined) {
    const normalized = ifMatch?.replace(/^W\//, "").replaceAll('"', "");
    const version = normalized ? Number.parseInt(normalized, 10) : Number.NaN;
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestException('Header If-Match wajib berisi versi, contoh: "1".');
    }
    return version;
  }
}
