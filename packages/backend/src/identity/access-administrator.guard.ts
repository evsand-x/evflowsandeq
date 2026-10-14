import { isAccessAdministrator } from "@evflow/contracts";
import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AccessAdministratorGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!isAccessAdministrator(request.auth))
      throw new ForbiddenException("Pengaturan pengguna dan hak akses hanya untuk Admin Sistem.");
    return true;
  }
}
