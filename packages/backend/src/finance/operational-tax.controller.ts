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
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { prisma } from "@evflow/database";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import { RequireResourcePermission } from "../identity/resource-permissions";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { saveTax, parsed, recordTaxInvoice, setDefaultTax } from "./operational-tax";
import { hasResourcePermission } from "../identity/resource-permissions";
import { ForbiddenException } from "@nestjs/common";
const querySchema = z
  .object({
    q: z.string().trim().max(150).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
const uuid = (value: string) => parsed(z.string().uuid(), value);
const commandKey = (value?: string) => parsed(z.string().min(8).max(200), value);

@Controller("tax")
@UseGuards(AuthGuard, PermissionGuard)
export class OperationalTaxController {
  @Get("options")
  async options(@Req() r: AuthenticatedRequest, @Query() input: unknown) {
    const { usage } = parsed(
      z.object({ usage: z.enum(["SALES", "PURCHASE"]).optional() }).strict(),
      input,
    );
    if (
      ![
        "sales_order.create",
        "sales_order.update",
        "supplier_invoice.create",
        "tax_setting.read",
      ].some((code) => hasResourcePermission(r.auth, code))
    )
      throw new ForbiddenException();
    return {
      data: await prisma.operationalTax.findMany({
        where: {
          companyId: r.auth.company_id,
          active: true,
          effectiveFrom: { lte: new Date() },
          ...(usage ? { usage: { in: [usage, "BOTH"] } } : {}),
        },
        select: {
          id: true,
          name: true,
          kind: true,
          effect: true,
          percentage: true,
          dppFactor: true,
          usage: true,
          isDefaultSales: true,
          isDefaultPurchase: true,
        },
        orderBy: { name: "asc" },
      }),
    };
  }
  @Get("master")
  @RequirePermissions("tax_setting.read")
  async list(@Query() input: unknown, @Req() r: AuthenticatedRequest) {
    const { q, page } = parsed(querySchema, input);
    const where = {
      companyId: r.auth.company_id,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.operationalTax.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 20,
        skip: (page - 1) * 20,
      }),
      prisma.operationalTax.count({ where }),
    ]);
    return { data, total };
  }
  @Get("accounts")
  @RequirePermissions("tax_setting.read")
  async accounts(@Req() r: AuthenticatedRequest) {
    return {
      data: await prisma.financeAccount.findMany({
        where: { companyId: r.auth.company_id, accountType: "DETAIL" },
        select: { id: true, code: true, name: true, category: true, active: true },
        orderBy: { code: "asc" },
      }),
    };
  }
  @Get("master/:id")
  @RequirePermissions("tax_setting.read")
  async detail(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    const data = await prisma.operationalTax.findFirst({
      where: { id: uuid(id), companyId: r.auth.company_id },
    });
    if (!data) throw new NotFoundException();
    return {
      data,
      revisions: await prisma.operationalTaxRevision.findMany({
        where: { taxId: data.id, companyId: r.auth.company_id },
        orderBy: { version: "desc" },
      }),
    };
  }
  @Post("master")
  @RequirePermissions("tax_setting.update")
  async create(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") key?: string,
  ) {
    return { data: await saveTax(r.auth.company_id, r.auth.user_id, body, commandKey(key)) };
  }
  @Patch("master/:id")
  @RequirePermissions("tax_setting.update")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") key?: string,
    @Headers("if-match") version?: string,
  ) {
    if (!/^"[1-9]\d*"$/.test(version ?? "")) throw new BadRequestException("If-Match versi wajib.");
    return {
      data: await saveTax(
        r.auth.company_id,
        r.auth.user_id,
        body,
        commandKey(key),
        uuid(id),
        Number(version!.slice(1, -1)),
      ),
    };
  }
  /** Marks the tax as the company default for sales or purchases (Setting > Pajak). */
  @Post("master/:id/default")
  @RequirePermissions("tax_setting.update")
  async setDefault(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") key?: string,
    @Headers("if-match") version?: string,
  ) {
    if (!/^"[1-9]\d*"$/.test(version ?? "")) throw new BadRequestException("If-Match versi wajib.");
    const { usage } = parsed(z.object({ usage: z.enum(["SALES", "PURCHASE"]) }).strict(), body);
    return {
      data: await setDefaultTax(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        usage,
        Number(version!.slice(1, -1)),
        commandKey(key),
      ),
    };
  }
  @Get("invoices/:direction")
  @RequireResourcePermission("taxInvoices", "read", "params", "direction")
  async invoices(
    @Param("direction") direction: string,
    @Query() input: unknown,
    @Req() r: AuthenticatedRequest,
  ) {
    const c = r.auth.company_id,
      { q, page } = parsed(querySchema, input);
    const output = direction === "output";
    const where = {
      companyId: c,
      ...(q ? { number: { contains: q, mode: "insensitive" as const } } : {}),
    };
    const data = output
      ? await prisma.salesInvoice.findMany({
          where,
          select: {
            id: true,
            number: true,
            state: true,
            subtotal: true,
            taxAmount: true,
            total: true,
            currency: true,
            freightTaxAmount: true,
            customer: { select: { name: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: (page - 1) * 20,
          take: 20,
        })
      : await prisma.supplierInvoice.findMany({
          where,
          select: {
            id: true,
            number: true,
            externalNumber: true,
            state: true,
            subtotal: true,
            taxAmount: true,
            total: true,
            currency: true,
            supplier: { select: { name: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: (page - 1) * 20,
          take: 20,
        });
    const total = output
      ? await prisma.salesInvoice.count({ where })
      : await prisma.supplierInvoice.count({ where });
    const documents = await prisma.operationalTaxInvoice.findMany({
      where: {
        companyId: c,
        direction: output ? "OUTPUT" : "INPUT",
        sourceId: { in: data.map((row) => row.id) },
      },
    });
    const legacy = output
      ? await prisma.officialTaxDocument.findMany({
          where: {
            companyId: c,
            sourceType: "SALES_INVOICE",
            sourceId: { in: data.map((row) => row.id) },
          },
          orderBy: { documentDate: "desc" },
        })
      : [];
    return {
      data: data.map((row) => ({
        ...row,
        taxAmount:
          "freightTaxAmount" in row ? row.taxAmount.add(row.freightTaxAmount) : row.taxAmount,
        document:
          documents.find((doc) => doc.sourceId === row.id) ??
          (() => {
            const old = legacy.find((doc) => doc.sourceId === row.id);
            return old
              ? {
                  number: old.number,
                  documentDate: old.documentDate,
                  evidenceId: old.evidenceId,
                  version: 0,
                }
              : null;
          })(),
      })),
      total,
    };
  }
  @Post("invoices/:direction/:id")
  @RequireResourcePermission("taxInvoices", "update", "params", "direction")
  async record(
    @Param("direction") direction: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") key?: string,
  ) {
    return {
      data: await recordTaxInvoice(
        r.auth.company_id,
        r.auth.user_id,
        direction === "output" ? "OUTPUT" : "INPUT",
        uuid(id),
        body,
        commandKey(key),
      ),
    };
  }
}
