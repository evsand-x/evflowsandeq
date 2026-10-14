import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "./auth.types";
import { REQUIRED_PERMISSIONS } from "./permissions.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
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
