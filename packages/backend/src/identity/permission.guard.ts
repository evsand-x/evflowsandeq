import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "./auth.types";
import { REQUIRED_PERMISSIONS } from "./permissions.decorator";
import { isAccessAdministrator } from "@evflow/contracts";
import {
  RESOURCE_PERMISSION,
  resourcePermissionCode,
  type ResourceRule,
} from "./resource-permissions";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = [
      ...(this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []),
    ];
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rule = this.reflector.getAllAndOverride<ResourceRule>(RESOURCE_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (rule)
      required.push(
        resourcePermissionCode(
          rule,
          (request[rule.source] as Record<string, unknown> | undefined)?.[rule.key],
        ),
      );
    if (!required.length) return true;
    if (isAccessAdministrator(request.auth)) return true;
    const hasRequiredScope = (code: string) =>
      request.auth.permissions.some(
        (permission) =>
          permission.code === code &&
          ["company", "privileged"].includes(permission.scope_type) &&
          (!permission.scope_id || permission.scope_id === request.auth.company_id),
      );
    if (!required.every(hasRequiredScope)) {
      throw new ForbiddenException("Izin atau scope tidak mencukupi.");
    }
    return true;
  }
}
