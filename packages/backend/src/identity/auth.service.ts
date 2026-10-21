import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { parseServerEnv } from "@evflow/config/env";
import { companySelectionRequiredSchema, type AuthPrincipal } from "@evflow/contracts";
import { prisma } from "@evflow/database";
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { verifyPassword } from "./password";

interface AccessClaims extends jwt.JwtPayload {
  sub: string;
  membership_id: string;
  company_id: string;
  sid: string;
}

@Injectable()
export class AuthService {
  private readonly environment = parseServerEnv(process.env);

  issueCsrf(response: Response) {
    const token = randomBytes(32).toString("base64url");
    response.cookie("csrf_token", token, {
      httpOnly: false,
      secure: this.environment.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return token;
  }

  assertCsrf(request: Request) {
    const origin = request.header("origin");
    if (
      (origin && !this.environment.APP_ORIGINS.includes(origin)) ||
      (this.environment.NODE_ENV === "production" && !origin)
    ) {
      throw new UnauthorizedException("Origin request tidak diizinkan.");
    }
    const cookies = this.parseCookies(request.headers.cookie);
    const header = request.header("x-csrf-token");
    if (!header || !cookies.csrf_token || header !== cookies.csrf_token) {
      throw new UnauthorizedException("CSRF token tidak valid.");
    }
  }

  async login(
    input: { email: string; password: string; company_id?: string | undefined },
    request: Request,
    response: Response,
  ) {
    this.assertCsrf(request);
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        memberships: {
          where: {
            active: true,
            deletedAt: null,
            ...(input.company_id ? { companyId: input.company_id } : {}),
          },
          include: { company: true },
          orderBy: [{ company: { name: "asc" } }, { companyId: "asc" }],
        },
      },
    });

    if (!user?.active || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Email atau kata sandi tidak sesuai.");
    }
    if (user.memberships.length === 0) {
      throw new UnauthorizedException("Email atau kata sandi tidak sesuai.");
    }
    if (user.memberships.length > 1 && !input.company_id) {
      throw new ConflictException({
        message: "Pilih perusahaan untuk melanjutkan.",
        ...companySelectionRequiredSchema.parse({
          code: "COMPANY_SELECTION_REQUIRED",
          companies: user.memberships.map(({ company }) => ({
            id: company.id,
            name: company.name,
          })),
        }),
      });
    }

    const membership = user.memberships[0]!;
    const expiresAt = new Date(
      Date.now() + this.environment.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const refreshToken = randomBytes(48).toString("base64url");
    const session = await prisma.$transaction(async (transaction) => {
      const created = await transaction.authSession.create({
        data: {
          companyId: membership.companyId,
          membershipId: membership.id,
          sessionFamilyId: randomUUID(),
          ...(request.header("user-agent")
            ? { deviceLabel: request.header("user-agent")!.slice(0, 250) }
            : {}),
          expiresAt,
        },
      });
      await transaction.refreshToken.create({
        data: {
          sessionId: created.id,
          tokenHash: this.hashRefreshToken(refreshToken),
          expiresAt,
        },
      });
      await transaction.auditEvent.create({
        data: {
          companyId: membership.companyId,
          actorId: user.id,
          action: "auth.login",
          resourceType: "auth_session",
          resourceId: created.id,
          metadata: { device_label: created.deviceLabel },
        },
      });
      return created;
    });
    const principal = await this.getPrincipal(session.id);
    this.setAuthCookies(response, principal, session.id, refreshToken);
    return principal;
  }

  async refresh(request: Request, response: Response) {
    this.assertCsrf(request);
    const refreshToken = this.parseCookies(request.headers.cookie).refresh_token;
    if (!refreshToken) throw new UnauthorizedException("Refresh token tidak tersedia.");
    const tokenHash = this.hashRefreshToken(refreshToken);
    const replacementToken = randomBytes(48).toString("base64url");
    const replacementHash = this.hashRefreshToken(replacementToken);

    const rotation = await prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM refresh_tokens WHERE token_hash = ${tokenHash} FOR UPDATE
      `;
      if (!rows[0]) throw new UnauthorizedException("Refresh token tidak valid.");
      const stored = await transaction.refreshToken.findUnique({
        where: { id: rows[0].id },
        include: { session: true },
      });
      if (!stored) throw new UnauthorizedException("Refresh token tidak valid.");
      if (stored.consumedAt || stored.revokedAt) {
        await transaction.authSession.update({
          where: { id: stored.sessionId },
          data: { revokedAt: new Date(), revokedReason: "refresh_token_reuse" },
        });
        await transaction.refreshToken.updateMany({
          where: { sessionId: stored.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { reused: true as const, sessionId: stored.sessionId };
      }
      if (
        stored.expiresAt <= new Date() ||
        stored.session.expiresAt <= new Date() ||
        stored.session.revokedAt
      ) {
        throw new UnauthorizedException("Sesi telah kedaluwarsa atau dicabut.");
      }
      const replacement = await transaction.refreshToken.create({
        data: {
          sessionId: stored.sessionId,
          tokenHash: replacementHash,
          expiresAt: stored.expiresAt,
        },
      });
      await transaction.refreshToken.update({
        where: { id: stored.id },
        data: { consumedAt: new Date(), replacedByTokenId: replacement.id },
      });
      await transaction.authSession.update({
        where: { id: stored.sessionId },
        data: { lastSeenAt: new Date() },
      });
      return { reused: false as const, sessionId: stored.sessionId };
    });

    if (rotation.reused) {
      response.clearCookie("access_token", { path: "/" });
      response.clearCookie("refresh_token", { path: "/api/v1/auth" });
      throw new UnauthorizedException("Sesi dicabut karena refresh token digunakan ulang.");
    }

    const principal = await this.getPrincipal(rotation.sessionId);
    this.setAuthCookies(response, principal, rotation.sessionId, replacementToken);
    return principal;
  }

  async logout(request: Request, response: Response) {
    this.assertCsrf(request);
    const refreshToken = this.parseCookies(request.headers.cookie).refresh_token;
    let sessionId: string | undefined;
    if (refreshToken) {
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: this.hashRefreshToken(refreshToken) },
      });
      sessionId = stored?.sessionId;
    }
    if (!sessionId) {
      const access = this.readAccessToken(request);
      if (access) {
        try {
          sessionId = this.verifyAccessToken(access.token).sid;
        } catch {
          // An expired access cookie must not prevent the browser from clearing its session.
        }
      }
    }
    if (sessionId) {
      const session = await prisma.authSession.findUnique({
        where: { id: sessionId },
        include: { membership: true },
      });
      if (session) {
        await prisma.$transaction(async (transaction) => {
          await transaction.authSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date(), revokedReason: "logout" },
          });
          await transaction.refreshToken.updateMany({
            where: { sessionId: session.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await transaction.auditEvent.create({
            data: {
              companyId: session.companyId,
              actorId: session.membership.userId,
              action: "auth.logout",
              resourceType: "auth_session",
              resourceId: session.id,
            },
          });
        });
      }
    }
    response.clearCookie("access_token", { path: "/" });
    response.clearCookie("refresh_token", { path: "/api/v1/auth" });
  }

  verifyAccessToken(token: string): AccessClaims {
    try {
      return jwt.verify(token, this.environment.JWT_ACCESS_SECRET, {
        algorithms: ["HS256"],
        issuer: this.environment.JWT_ISSUER,
        audience: this.environment.JWT_AUDIENCE,
      }) as AccessClaims;
    } catch {
      throw new UnauthorizedException("Access token tidak valid atau kedaluwarsa.");
    }
  }

  async getPrincipal(sessionId: string): Promise<AuthPrincipal> {
    const session = await prisma.authSession.findUnique({
      where: { id: sessionId },
      include: {
        membership: {
          include: {
            company: { select: { name: true } },
            user: true,
            userRoles: {
              include: {
                role: { include: { rolePermissions: { include: { permission: true } } } },
              },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.membership.active ||
      !!session.membership.deletedAt ||
      !session.membership.user.active
    ) {
      throw new UnauthorizedException("Sesi tidak aktif.");
    }
    const permissionMap = new Map<string, AuthPrincipal["permissions"][number]>();
    for (const userRole of session.membership.userRoles) {
      if (!userRole.role.active) continue;
      for (const grant of userRole.role.rolePermissions) {
        const key = `${grant.permission.code}:${grant.scopeType}:${grant.scopeId ?? ""}`;
        permissionMap.set(key, {
          code: grant.permission.code,
          scope_type: grant.scopeType,
          scope_id: grant.scopeId,
        });
      }
    }
    if (
      session.membership.userRoles.some(
        (item) => item.role.active && item.role.code === "ADMIN_SYSTEM",
      )
    ) {
      const catalog = await prisma.permission.findMany({ select: { code: true } });
      for (const permission of catalog) {
        permissionMap.set(`${permission.code}:company:`, {
          code: permission.code,
          scope_type: "company",
          scope_id: null,
        });
      }
    }
    return {
      user_id: session.membership.user.id,
      membership_id: session.membership.id,
      company_id: session.companyId,
      company_name: session.membership.company.name,
      display_name: session.membership.user.displayName,
      email: session.membership.user.email,
      roles: session.membership.userRoles
        .filter((item) => item.role.active)
        .map((item) => ({ code: item.role.code, name: item.role.name })),
      permissions: [...permissionMap.values()],
    };
  }

  readAccessToken(request: Request) {
    const authorization = request.header("authorization");
    if (authorization?.startsWith("Bearer ")) {
      return { token: authorization.slice(7), source: "bearer" as const };
    }
    const token = this.parseCookies(request.headers.cookie).access_token;
    return token ? { token, source: "cookie" as const } : undefined;
  }

  private setAuthCookies(
    response: Response,
    principal: AuthPrincipal,
    sessionId: string,
    refreshToken: string,
  ) {
    const secure = this.environment.NODE_ENV === "production";
    const accessToken = jwt.sign(
      {
        membership_id: principal.membership_id,
        company_id: principal.company_id,
        sid: sessionId,
      },
      this.environment.JWT_ACCESS_SECRET,
      {
        subject: principal.user_id,
        expiresIn: this.environment.ACCESS_TOKEN_TTL_SECONDS,
        issuer: this.environment.JWT_ISSUER,
        audience: this.environment.JWT_AUDIENCE,
        algorithm: "HS256",
      },
    );
    response.cookie("access_token", accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: this.environment.ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    response.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: this.environment.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private hashRefreshToken(value: string) {
    return createHmac("sha256", this.environment.JWT_REFRESH_SECRET).update(value).digest("hex");
  }

  private parseCookies(header: string | undefined) {
    return Object.fromEntries(
      (header ?? "")
        .split(";")
        .map((part) => part.trim().split("="))
        .filter(([key, value]) => Boolean(key && value))
        .map(([key, value]) => [key!, decodeURIComponent(value!)]),
    ) as Record<string, string>;
  }
}
