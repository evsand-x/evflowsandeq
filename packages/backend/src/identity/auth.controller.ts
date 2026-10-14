import { authResponseSchema, loginRequestSchema } from "@evflow/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get("csrf")
  csrf(@Res({ passthrough: true }) response: Response) {
    return { data: { csrf_token: this.authService.issueCsrf(response) } };
  }

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = loginRequestSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return authResponseSchema.parse({
      data: await this.authService.login(input.data, request, response),
    });
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return authResponseSchema.parse({
      data: await this.authService.refresh(request, response),
    });
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request, response);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return authResponseSchema.parse({
      data: {
        user_id: request.auth.user_id,
        membership_id: request.auth.membership_id,
        company_id: request.auth.company_id,
        company_name: request.auth.company_name,
        display_name: request.auth.display_name,
        email: request.auth.email,
        roles: request.auth.roles,
        permissions: request.auth.permissions,
      },
    });
  }
}
