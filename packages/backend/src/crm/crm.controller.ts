import {
  RequireResourcePermission,
  hasResourcePermission,
  requireRelatedPermissions,
} from "../identity/resource-permissions";
import {
  isAccessAdministrator,
  createContactSchema,
  createProspectSchema,
  createOpportunitySchema,
  addProspectNeedsSchema,
  createCrmActivitySchema,
  registerCrmAttachmentSchema,
  createQuoteSchema,
  createCustomerOrderSchema,
  winOpportunitySchema,
  loseOpportunitySchema,
  crmResourceSchema,
} from "@evflow/contracts";
import { Prisma, prisma } from "@evflow/database";
import { z } from "zod";
import {
  BadRequestException,
  ForbiddenException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import { CrmService } from "./crm.service";
import { crmListQuerySchema } from "@evflow/contracts";
import {
  crmPage,
  crmDetail,
  crmSummary,
  customerSelect,
  opportunityInclude,
} from "./crm-workspace";

@Controller()
@UseGuards(AuthGuard, PermissionGuard)
export class CrmController {
  constructor(@Inject(CrmService) private readonly crm: CrmService) {}

  @Get("crm/options")
  @RequireResourcePermission("crm", "create", "query")
  async options(
    @Query("q") q: string | undefined,
    @Query("customer_id") customerId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (q && q.length > 150) throw new BadRequestException("Pencarian terlalu panjang.");
    if (customerId && !z.string().uuid().safeParse(customerId).success)
      throw new BadRequestException("Pelanggan tidak valid.");
    const companyId = req.auth.company_id;
    const [customers, owners, products, uoms, channels, rayons, contacts] = await Promise.all([
      prisma.customer.findMany({
        where: {
          companyId,
          ...(q?.trim() ? { name: { contains: q.trim(), mode: "insensitive" } } : {}),
        },
        select: customerSelect,
        orderBy: { name: "asc" },
        take: 50,
      }),
      prisma.companyMembership.findMany({
        where: { companyId, active: true },
        select: { user: { select: { id: true, displayName: true } } },
      }),
      prisma.product.findMany({
        where: {
          companyId,
          ...(q?.trim() ? { name: { contains: q.trim(), mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      prisma.uom.findMany({
        where: { companyId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.customerChannel.findMany({
        where: { companyId, state: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.rayon.findMany({
        where: { companyId, state: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      customerId && hasResourcePermission(req.auth, "crm_contact.read")
        ? prisma.contact.findMany({
            where: {
              companyId,
              customerId,
              state: "ACTIVE",
              ...(q?.trim() ? { fullName: { contains: q.trim(), mode: "insensitive" } } : {}),
            },
            select: { id: true, fullName: true, jobTitle: true },
            orderBy: { fullName: "asc" },
            take: 50,
          })
        : Promise.resolve([]),
    ]);
    return {
      data: {
        channels,
        rayons,
        customers: serialize(customers),
        owners: owners.map((o) => ({ id: o.user.id, name: o.user.displayName })),
        products,
        uoms,
        contacts: contacts.map((contact) => ({
          id: contact.id,
          name: [contact.fullName, contact.jobTitle].filter(Boolean).join(" · "),
        })),
      },
    };
  }

  @Get("crm/workspace/summary")
  @RequirePermissions("crm_prospect.read")
  async summary(@Req() req: AuthenticatedRequest) {
    return { data: serialize(await crmSummary(req.auth.company_id)) };
  }

  @Get("crm/activities/:resourceType/:resourceId")
  @RequirePermissions("crm_activity.read")
  @RequireResourcePermission("related", "read", "params", "resourceType")
  async activities(
    @Param("resourceType") resourceType: string,
    @Param("resourceId") resourceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(resourceId).success)
      throw new BadRequestException("Referensi aktivitas tidak valid.");
    return {
      data: serialize(await this.crm.listActivities(req.auth.company_id, resourceId, resourceType)),
    };
  }

  @Post("crm/activities")
  @RequirePermissions("crm_activity.create")
  async createActivity(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException("Idempotency-Key UUID wajib diisi.");
    const input = createCrmActivitySchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    requireRelatedPermissions(req.auth, input.data);
    return {
      data: serialize(
        await this.crm.createActivity(req.auth.company_id, req.auth.user_id, input.data, key!),
      ),
    };
  }

  @Get("crm/attachments/:resourceType/:resourceId")
  @RequireResourcePermission("related", "read", "params", "resourceType")
  async attachments(
    @Param("resourceType") resourceType: string,
    @Param("resourceId") resourceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(resourceId).success)
      throw new BadRequestException("Referensi lampiran tidak valid.");
    return {
      data: serialize(
        await this.crm.listAttachments(req.auth.company_id, resourceType, resourceId),
      ),
    };
  }

  @Post("crm/attachments")
  @RequireResourcePermission("related", "create", "body", "resource_type")
  async registerAttachment(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException("Idempotency-Key UUID wajib diisi.");
    const input = registerCrmAttachmentSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.crm.registerAttachment(req.auth.company_id, req.auth.user_id, input.data, key!),
      ),
    };
  }

  @Get("crm/quotes")
  @RequirePermissions("crm_quote.read")
  async quotes(
    @Query("customer_id") customerId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (customerId && !z.string().uuid().safeParse(customerId).success)
      throw new BadRequestException("Referensi pelanggan tidak valid.");
    return { data: serialize(await this.crm.listQuotes(req.auth.company_id, customerId)) };
  }

  @Post("crm/quotes")
  @RequirePermissions("crm_quote.create")
  async createQuote(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException("Idempotency-Key UUID wajib diisi.");
    const input = createQuoteSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.crm.createQuote(req.auth.company_id, req.auth.user_id, input.data, key!),
      ),
    };
  }

  @Post("crm/customer-orders")
  @RequirePermissions("crm_customer_order.create")
  async createCustomerOrder(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException("Idempotency-Key UUID wajib diisi.");
    const input = createCustomerOrderSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.crm.createCustomerOrder(req.auth.company_id, req.auth.user_id, input.data, key!),
      ),
    };
  }

  @Post("crm/customer-orders/:id/verify")
  @RequirePermissions("crm_customer_order.update")
  async verifyCustomerOrder(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Referensi PO/SP tidak valid.");
    return {
      data: serialize(
        await this.crm.verifyCustomerOrder(req.auth.company_id, req.auth.user_id, id),
      ),
    };
  }

  @Post("crm/opportunities/:id/win")
  @RequirePermissions("crm_opportunity.update")
  async winOpportunity(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Referensi peluang tidak valid.");
    const input = winOpportunitySchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.crm.winOpportunity(req.auth.company_id, req.auth.user_id, id, input.data),
      ),
    };
  }

  @Post("crm/opportunities/:id/lose")
  @RequirePermissions("crm_opportunity.update")
  async loseOpportunity(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Referensi peluang tidak valid.");
    const input = loseOpportunitySchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.crm.loseOpportunity(req.auth.company_id, req.auth.user_id, id, input.data),
      ),
    };
  }

  @Get("crm/workspace/opportunities")
  @RequirePermissions("crm_opportunity.read")
  async opportunityList(@Query() query: unknown, @Req() req: AuthenticatedRequest) {
    const parsed = crmListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { q, page } = parsed.data;
    const contains = { contains: q, mode: "insensitive" as const };
    const where = {
      companyId: req.auth.company_id,
      ...(q ? { OR: [{ code: contains }, { customer: { name: contains } }] } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.opportunity.findMany({
        where,
        select: {
          id: true,
          code: true,
          period: true,
          state: true,
          prospectId: true,
          notes: true,
          customer: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 20,
        skip: (page - 1) * 20,
      }),
      prisma.opportunity.count({ where }),
    ]);
    return serialize({ data, total, page, pageSize: 20 });
  }

  @Get("crm/workspace/:resource")
  @RequireResourcePermission("crm", "read")
  async workspace(
    @Param("resource") resource: string,
    @Query() query: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!crmResourceSchema.safeParse(resource).success)
      throw new BadRequestException("Jenis data CRM tidak tersedia.");
    const parsed = crmListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return serialize(await crmPage(req.auth.company_id, resource, parsed.data));
  }

  @Get("crm/workspace/:resource/:id")
  @RequireResourcePermission("crm", "read")
  async detail(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const parsed = crmResourceSchema.safeParse(resource);
    if (!parsed.success || !z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Referensi CRM tidak valid.");
    return {
      data: serialize(
        await crmDetail(
          req.auth.company_id,
          parsed.data,
          id,
          hasResourcePermission(req.auth, "crm_contact.read"),
        ),
      ),
    };
  }

  @Get("crm/master/customers")
  @RequirePermissions("crm_customer.read")
  async customers(@Query() query: unknown, @Req() req: AuthenticatedRequest) {
    const parsed = crmListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return serialize(await crmPage(req.auth.company_id, "customers", parsed.data));
  }

  @Get("crm/master/customers/:id")
  @RequirePermissions("crm_customer.read")
  async customer(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Referensi pelanggan tidak valid.");
    // Contacts retain their independent CRM permission even from the master page.
    const crmAllowed =
      isAccessAdministrator(req.auth) ||
      req.auth.permissions.some(
        (p) =>
          p.code === "crm_contact.read" &&
          ["company", "privileged"].includes(p.scope_type) &&
          (!p.scope_id || p.scope_id === req.auth.company_id),
      );
    const data = await crmDetail(req.auth.company_id, "customers", id, crmAllowed);
    return { data: serialize(data) };
  }

  @Get("crm/:resource")
  @RequireResourcePermission("crm", "read")
  async list(
    @Param("resource") resource: string,
    @Query("q") search: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const parsed = crmResourceSchema.safeParse(resource);
    if (!parsed.success) throw new BadRequestException("Jenis data CRM tidak tersedia.");
    return { data: serialize(await this.crm.list(req.auth.company_id, parsed.data, search)) };
  }

  @Patch("crm/contacts/:id")
  @RequirePermissions("crm_contact.update")
  async updateContact(
    @Param("id") id: string,
    @Headers("if-match") match: string | undefined,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!/^"[1-9]\d*"$/.test(match ?? "")) throw new BadRequestException("If-Match versi wajib.");
    const input = createContactSchema.parse(body);
    return {
      data: serialize(
        await this.crm.updateContact(
          req.auth.company_id,
          req.auth.user_id,
          z.string().uuid().parse(id),
          Number(match!.slice(1, -1)),
          input,
        ),
      ),
    };
  }

  @Post("crm/contacts")
  @RequirePermissions("crm_contact.create")
  async createContact(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException("Idempotency-Key UUID wajib diisi.");
    const input = createContactSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.crm.createContact(req.auth.company_id, req.auth.user_id, input.data, key),
      ),
    };
  }

  @Post("crm/prospects")
  @RequirePermissions("crm_prospect.create")
  async createProspect(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException("Idempotency-Key UUID wajib diisi.");
    const input = createProspectSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    if (input.data.new_customer && !hasResourcePermission(req.auth, "crm_customer.create"))
      throw new ForbiddenException("Izin membuat pelanggan CRM diperlukan.");
    if (input.data.contact_ids?.length && !hasResourcePermission(req.auth, "crm_contact.read"))
      throw new ForbiddenException("Izin membaca kontak diperlukan.");
    return {
      data: serialize(
        await this.crm.createProspect(req.auth.company_id, req.auth.user_id, input.data, key),
      ),
    };
  }

  @Patch("crm/prospects/:id/status")
  @RequirePermissions("crm_prospect.update")
  async updateStatus(
    @Param("id") id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const version = /^"[1-9]\d*"$/.test(ifMatch ?? "") ? Number(ifMatch!.slice(1, -1)) : NaN;
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Referensi prospek tidak valid.");
    if (!Number.isSafeInteger(version) || version < 1)
      throw new BadRequestException('Header If-Match wajib berisi versi, contoh: "1".');
    const input = z
      .object({
        approach_status: z.enum(["NEW", "IN_PROGRESS", "POTENTIAL", "DEFERRED", "DROPPED"]),
        notes: z.string().trim().max(2000).nullable().optional(),
      })
      .strict()
      .safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.crm.updateProspectStatus(
          req.auth.company_id,
          req.auth.user_id,
          id,
          version,
          input.data.approach_status,
          input.data.notes,
        ),
      ),
    };
  }

  @Post("crm/prospects/:id/needs")
  @RequirePermissions("crm_prospect.create")
  async addNeeds(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(key).success)
      throw new BadRequestException("Referensi dan Idempotency-Key UUID wajib diisi.");
    const input = addProspectNeedsSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.crm.addNeeds(req.auth.company_id, req.auth.user_id, id, input.data, key!),
      ),
    };
  }

  @Get("crm/prospects/:id/opportunities")
  @RequirePermissions("crm_prospect.read", "crm_opportunity.read")
  async opportunities(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Referensi prospek tidak valid.");
    await crmDetail(req.auth.company_id, "prospects", id, false);
    return {
      data: serialize(
        await prisma.opportunity.findMany({
          where: { companyId: req.auth.company_id, prospectId: id },
          include: opportunityInclude,
          orderBy: { createdAt: "desc" },
        }),
      ),
    };
  }

  @Post("crm/opportunities")
  @RequirePermissions("crm_opportunity.create")
  async createOpportunity(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException("Idempotency-Key UUID wajib diisi.");
    const input = createOpportunitySchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    requireRelatedPermissions(req.auth, {
      prospect_id: input.data.prospect_id,
      ...(input.data.contact_ids.length ? { contact_id: true } : {}),
    });
    return {
      data: serialize(
        await this.crm.createOpportunity(req.auth.company_id, req.auth.user_id, input.data, key),
      ),
    };
  }
}

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        serialize(item),
      ]),
    );
  return value;
}
