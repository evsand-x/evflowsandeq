import {
  accessHistory,
  accessUserDetail,
  accessRoleMembers,
  accessListSchema,
} from "./access-workspace";
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
  Query,
  ParseUUIDPipe,
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

  @Get("access-workspace/users")
  @RequirePermissions("user.read")
  async userPage(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const parsed = accessListSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const q = parsed.data;
    const rows = (await this.access.listUsers(request.auth.company_id)).filter(
      (u) =>
        (!q.q || `${u.display_name} ${u.email}`.toLowerCase().includes(q.q.toLowerCase())) &&
        (q.status === "all" || u.active === (q.status === "active")) &&
        (q.role === "all" || u.roles.some((r) => r.id === q.role)),
    );
    return { data: rows.slice((q.page - 1) * 20, q.page * 20), total: rows.length, page: q.page };
  }
  @Get("access-workspace/roles")
  @RequirePermissions("role.read")
  async rolePage(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const parsed = accessListSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const q = parsed.data;
    const rows = (await this.access.listRoles(request.auth.company_id)).filter(
      (r) =>
        (!q.q || r.name.toLowerCase().includes(q.q.toLowerCase())) &&
        (q.status === "all" || r.active === (q.status === "active")),
    );
    return { data: rows.slice((q.page - 1) * 20, q.page * 20), total: rows.length, page: q.page };
  }
  @Get("users/:id")
  @RequirePermissions("user.read")
  async userDetail(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const detail = await accessUserDetail(request.auth.company_id, id);
    const user = (await this.access.listUsers(request.auth.company_id)).find(
      (u) => u.user_id === id,
    );
    return { data: { ...user, ...detail } };
  }
  @Get("users/:id/history")
  @RequirePermissions("user.read")
  async userHistory(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return { data: await accessHistory(request.auth.company_id, "user", id) };
  }
  @Get("roles/:id/history")
  @RequirePermissions("role.read")
  async roleHistory(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return { data: await accessHistory(request.auth.company_id, "role", id) };
  }
  @Get("roles/:id/members")
  @RequirePermissions("role.read", "user.read")
  async roleMembers(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return { data: await accessRoleMembers(request.auth.company_id, id) };
  }
  @Post("users/:id/revoke-sessions")
  @RequirePermissions("user.update")
  async revokeSessions(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.access.revokeSessions(request.auth.company_id, request.auth.user_id, id),
    };
  }

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

  @Delete("users/:id")
  @RequirePermissions("user.delete")
  async deleteUser(
    @Param("id", new ParseUUIDPipe()) userId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.access.deleteUser(request.auth.company_id, request.auth.user_id, userId),
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
        input.data.expected_permissions,
      ),
    };
  }

  @Get("permissions")
  @RequirePermissions("permission.read")
  async permissions() {
    return { data: await this.access.listPermissions() };
  }
}
