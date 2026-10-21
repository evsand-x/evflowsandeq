import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { prisma } from "@evflow/database";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { parsed } from "./operational-tax";
import { accountDetail, saveAccount, importAccounts } from "./accounts";
const uuid = (v: string) => parsed(z.string().uuid(), v);
const key = (v?: string) => parsed(z.string().min(8).max(200), v);
@Controller("accounts")
@UseGuards(AuthGuard, PermissionGuard)
export class AccountsController {
  @Get()
  @RequirePermissions("account.read")
  async list(@Query() input: unknown, @Req() r: AuthenticatedRequest) {
    const q = parsed(
      z
        .object({
          q: z.string().trim().max(200).default(""),
          page: z.coerce.number().int().min(1).max(100000).default(1),
          category: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]).optional(),
          status: z.enum(["active", "inactive"]).optional(),
        })
        .strict(),
      input,
    );
    const where = {
      companyId: r.auth.company_id,
      ...(q.category ? { category: q.category } : {}),
      ...(q.status ? { active: q.status === "active" } : {}),
      ...(q.q
        ? {
            OR: ["code", "name", "categoryLabel"].map((field) => ({
              [field]: { contains: q.q, mode: "insensitive" as const },
            })),
          }
        : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.financeAccount.findMany({
        where,
        orderBy: [{ code: "asc" }, { id: "asc" }],
        take: 25,
        skip: (q.page - 1) * 25,
      }),
      prisma.financeAccount.count({ where }),
    ]);
    return { data, total };
  }
  @Get("options")
  @RequirePermissions("account.read")
  async options(@Req() r: AuthenticatedRequest) {
    return {
      parents: await prisma.financeAccount.findMany({
        where: { companyId: r.auth.company_id, accountType: "HEADER" },
        select: { id: true, code: true, name: true, category: true, active: true },
        orderBy: { code: "asc" },
      }),
      categories: await prisma.financeAccount.findMany({
        where: { companyId: r.auth.company_id, categoryLabel: { not: null } },
        distinct: ["categoryLabel", "category"],
        select: { categoryLabel: true, category: true },
        orderBy: { categoryLabel: "asc" },
      }),
    };
  }
  @Get(":id")
  @RequirePermissions("account.read")
  detail(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return accountDetail(r.auth.company_id, uuid(id));
  }
  @Post()
  @RequirePermissions("account.create")
  async create(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await saveAccount(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Patch(":id")
  @RequirePermissions("account.update")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
    @Headers("if-match") version?: string,
  ) {
    if (!/^"[1-9]\d*"$/.test(version ?? ""))
      throw new BadRequestException("If-Match versi akun wajib.");
    return {
      data: await saveAccount(
        r.auth.company_id,
        r.auth.user_id,
        body,
        key(k),
        uuid(id),
        Number(version!.slice(1, -1)),
      ),
    };
  }
  @Post("import")
  @RequirePermissions("account.import")
  import(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return importAccounts(r.auth.company_id, r.auth.user_id, body, key(k));
  }
}
