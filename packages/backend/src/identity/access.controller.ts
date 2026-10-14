import {
  assignUserRolesSchema,
  createRoleSchema,
  createUserSchema,
  updateRolePermissionsSchema,
  updateRoleSchema,
  updateUserSchema,
} from "@evflow/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AccessService } from "./access.service";
import { AccessAdministratorGuard } from "./access-administrator.guard";
import { AuthGuard } from "./auth.guard";
import type { AuthenticatedRequest } from "./auth.types";
import { PermissionGuard } from "./permission.guard";
import { RequirePermissions } from "./permissions.decorator";

@Controller()
@UseGuards(AuthGuard, AccessAdministratorGuard, PermissionGuard)
export class AccessController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  @Get("users")
  @RequirePermissions("user.read")
  async users(@Req() request: AuthenticatedRequest) {
    return { data: await this.access.listUsers(request.auth.company_id) };
  }

  @Post("users")
  @RequirePermissions("user.create")
  async createUser(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = createUserSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.access.createUser(request.auth.company_id, request.auth.user_id, input.data),
    };
  }

  @Patch("users/:id/roles")
  @RequirePermissions("user.role.assign")
  async assignRoles(
    @Param("id") userId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = assignUserRolesSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.access.assignRoles(
        request.auth.company_id,
        request.auth.user_id,
        userId,
        input.data.role_ids,
      ),
    };
  }

  @Patch("users/:id")
  @RequirePermissions("user.update", "user.role.assign")
  async updateUser(
    @Param("id") userId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = updateUserSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.access.updateUser(
        request.auth.company_id,
        request.auth.user_id,
        userId,
        input.data,
      ),
    };
  }

  @Get("roles")
  @RequirePermissions("role.read")
  async roles(@Req() request: AuthenticatedRequest) {
    return { data: await this.access.listRoles(request.auth.company_id) };
  }

  @Post("roles")
  @RequirePermissions("role.create")
  async createRole(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = createRoleSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.access.createRole(request.auth.company_id, request.auth.user_id, input.data),
    };
  }

  @Patch("roles/:id")
  @RequirePermissions("role.update")
  async updateRole(
    @Param("id") roleId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = updateRoleSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.access.updateRole(
        request.auth.company_id,
        request.auth.user_id,
        roleId,
        input.data,
      ),
    };
  }

  @Delete("roles/:id")
  @RequirePermissions("role.delete")
  async deleteRole(@Param("id") roleId: string, @Req() request: AuthenticatedRequest) {
    return {
      data: await this.access.deleteRole(request.auth.company_id, request.auth.user_id, roleId),
    };
  }

  @Patch("roles/:id/permissions")
  @RequirePermissions("role.permission.update")
  async rolePermissions(
    @Param("id") roleId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = updateRolePermissionsSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.access.updateRolePermissions(
        request.auth.company_id,
        request.auth.user_id,
        roleId,
        input.data.permissions,
      ),
    };
  }

  @Get("permissions")
  @RequirePermissions("permission.read")
  async permissions() {
    return { data: await this.access.listPermissions() };
  }
}
