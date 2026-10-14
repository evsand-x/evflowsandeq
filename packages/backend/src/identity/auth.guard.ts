import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.authService.readAccessToken(request);
    if (!token) throw new UnauthorizedException("Autentikasi diperlukan.");
    const claims = this.authService.verifyAccessToken(token.token);
    const principal = await this.authService.getPrincipal(claims.sid);
    if (
      principal.user_id !== claims.sub ||
      principal.membership_id !== claims.membership_id ||
      principal.company_id !== claims.company_id
    ) {
      throw new UnauthorizedException("Scope sesi tidak valid.");
    }
    const authenticated = request as AuthenticatedRequest;
    authenticated.auth = { ...principal, session_id: claims.sid };
    authenticated.auth_source = token.source;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && token.source === "cookie") {
      this.authService.assertCsrf(request);
    }
    return true;
  }
}
