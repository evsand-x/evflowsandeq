import { Prisma, prisma } from "@evflow/database";
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import { AuditService } from "../common/audit.service";
import { contactInclude, prospectInclude, opportunityInclude, quoteInclude } from "./crm-workspace";
import { createHash, randomUUID } from "node:crypto";

@Injectable()
export class CrmService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async list(companyId: string, resource: "contacts" | "prospects", search?: string) {
    const term = search?.trim();
    const contains = term ? { contains: term, mode: "insensitive" as const } : undefined;
    if (resource === "contacts") {
      return prisma.contact.findMany({
        where: { companyId, ...(contains ? { fullName: contains } : {}) },
        include: contactInclude,
        orderBy: { fullName: "asc" },
      });
    }
    return prisma.prospect.findMany({
      where: { companyId, ...(contains ? { customer: { name: contains } } : {}) },
      include: prospectInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  async createContact(
    companyId: string,
    actorId: string,
    input: Record<string, unknown>,
    requestKey?: string,
  ) {
    const customerId = String(input.customer_id);
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) throw new NotFoundException("Pelanggan tidak ditemukan dalam perusahaan aktif.");
    const request = requestIdentity(companyId, actorId, "contact", input, requestKey);
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${request.id}, 0))::text`;
        const existing = await tx.contact.findFirst({
          where: { id: request.id, companyId },
          include: contactInclude,
        });
        if (existing) {
          await checkReplay(tx, request.id, request.hash);
          return existing;
        }
        const code = await this.nextCode(tx, companyId, "contact");
        const created = await tx.contact.create({
          data: {
            id: request.id,
            companyId,
            customerId,
            code,
            fullName: String(input.full_name).trim(),
            nickname: nullable(input.nickname),
            jobTitle: nullable(input.job_title),
            department: nullable(input.department),
            picFunctions: (input.pic_functions ?? []) as Prisma.InputJsonValue,
            phone: nullable(input.phone),
            email: nullable(input.email),
            birthDate: dateOrNull(input.birth_date),
            notes: nullable(input.notes),
            createdById: actorId,
            updatedById: actorId,
          },
          include: contactInclude,
        });
        await this.audit.recordWith(tx, {
          companyId,
          actorId,
          action: "crm.contact.created",
          resourceType: "contact",
          resourceId: created.id,
          after: { code, customerId, fullName: created.fullName },
          metadata: { request_hash: request.hash },
        });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("Kode kontak sudah digunakan.");
      throw error;
    }
  }

  async updateContact(
    companyId: string,
    actorId: string,
    id: string,
    version: number,
    input: Record<string, unknown>,
  ) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.contact.findFirst({ where: { id, companyId } });
      if (!current) throw new NotFoundException("Kontak tidak ditemukan.");
      if (current.version !== version)
        throw new PreconditionFailedException("Kontak berubah. Muat ulang sebelum menyimpan.");
      if (current.customerId !== input.customer_id)
        throw new ConflictException("Pelanggan kontak tidak dapat dipindahkan melalui form ini.");
      const data = {
        fullName: String(input.full_name).trim(),
        nickname: nullable(input.nickname),
        jobTitle: nullable(input.job_title),
        department: nullable(input.department),
        picFunctions: input.pic_functions as Prisma.InputJsonValue,
        phone: nullable(input.phone),
        email: nullable(input.email),
        birthDate: dateOrNull(input.birth_date),
        notes: nullable(input.notes),
        updatedById: actorId,
        version: { increment: 1 },
      };
      const changed = await tx.contact.updateMany({ where: { id, companyId, version }, data });
      if (changed.count !== 1)
        throw new PreconditionFailedException("Kontak berubah. Muat ulang sebelum menyimpan.");
      const updated = await tx.contact.findFirstOrThrow({
        where: { id, companyId },
        include: contactInclude,
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.contact.updated",
        resourceType: "contact",
        resourceId: id,
        before: current,
        after: updated,
      });
      return updated;
    });
  }

  async createProspect(
    companyId: string,
    actorId: string,
    input: Record<string, unknown>,
    requestKey?: string,
  ) {
    let customerId = input.customer_id ? String(input.customer_id) : "";
    const newCustomer = input.new_customer as
      | {
          name: string;
          channel_id: string;
          rayon_id?: string | null;
          primary_address?: string | null;
        }
      | undefined;
    const ownerId = String(input.owner_id);
    const [customer, owner] = await Promise.all([
      prisma.customer.findFirst({
        where: { id: customerId || "00000000-0000-0000-0000-000000000000", companyId },
      }),
      prisma.companyMembership.findFirst({ where: { companyId, userId: ownerId, active: true } }),
    ]);
    if (!customer && !newCustomer)
      throw new NotFoundException("Pelanggan tidak ditemukan dalam perusahaan aktif.");
    if (!owner)
      throw new NotFoundException("Penanggung jawab tidak ditemukan dalam perusahaan aktif.");
    const needs = (input.needs as Array<Record<string, unknown>> | undefined) ?? [];
    const contactIds = (input.contact_ids as string[] | undefined) ?? [];
    await this.validateNeeds(companyId, needs);
    const request = requestIdentity(companyId, actorId, "prospect", input, requestKey);
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${request.id}, 0))::text`;
        const existing = await tx.prospect.findFirst({
          where: { id: request.id, companyId },
          include: prospectInclude,
        });
        if (existing) {
          await checkReplay(tx, request.id, request.hash);
          return existing;
        }
        if (newCustomer) {
          const channel = await tx.customerChannel.findFirst({
            where: { id: newCustomer.channel_id, companyId, state: "ACTIVE" },
          });
          const rayon = newCustomer.rayon_id
            ? await tx.rayon.findFirst({
                where: { id: newCustomer.rayon_id, companyId, state: "ACTIVE" },
              })
            : null;
          if (!channel || (newCustomer.rayon_id && !rayon))
            throw new NotFoundException(
              "Channel atau rayon tidak ditemukan dalam perusahaan aktif.",
            );
          const customerCode = await this.nextCode(tx, companyId, "customer");
          const createdCustomer = await tx.customer.create({
            data: {
              companyId,
              code: customerCode,
              name: newCustomer.name.trim(),
              normalizedName: newCustomer.name.trim().toLowerCase().replace(/\s+/g, " "),
              channelId: channel.id,
              rayonId: rayon?.id ?? null,
              primaryAddress: newCustomer.primary_address ?? null,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          customerId = createdCustomer.id;
          await this.audit.recordWith(tx, {
            companyId,
            actorId,
            action: "crm.institution.created",
            resourceType: "customer",
            resourceId: customerId,
            after: { code: customerCode, relationshipStage: "PROSPECT" },
          });
        }
        if (contactIds.length) {
          const contacts = await tx.contact.findMany({
            where: { companyId, customerId, id: { in: contactIds }, state: "ACTIVE" },
            select: { id: true },
          });
          if (contacts.length !== contactIds.length)
            throw new NotFoundException(
              "Satu atau beberapa kontak tidak terdaftar pada pelanggan yang dipilih.",
            );
        }
        const code = await this.nextCode(tx, companyId, "prospect");
        const created = await tx.prospect.create({
          data: {
            id: request.id,
            companyId,
            customerId,
            code,
            ownerId,
            contactIds: contactIds as Prisma.InputJsonValue,
            source: nullable(input.source),
            approachStatus: String(input.approach_status ?? "NEW") as never,
            nextAction: nullable(input.next_action),
            nextActionAt: dateTimeOrNull(input.next_action_at),
            notes: nullable(input.notes),
            createdById: actorId,
            updatedById: actorId,
            needs: {
              create: needs.map((need) => ({
                companyId,
                productId: nullableUuid(need.product_id),
                description: nullable(need.description),
                estimatedQty: decimalOrNull(need.estimated_qty),
                uomId: nullableUuid(need.uom_id),
                neededOn: dateOrNull(need.needed_on),
                neededPeriod: nullable(need.needed_period),
                notes: nullable(need.notes),
                createdById: actorId,
              })),
            },
          },
          include: prospectInclude,
        });
        await this.audit.recordWith(tx, {
          companyId,
          actorId,
          action: "crm.prospect.created",
          resourceType: "prospect",
          resourceId: created.id,
          after: { code, customerId, approachStatus: created.approachStatus },
          metadata: { request_hash: request.hash },
        });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          "Pelanggan sudah memiliki profil prospek atau nama institusi sudah terdaftar.",
        );
      throw error;
    }
  }

  async createActivity(
    companyId: string,
    actorId: string,
    input: Record<string, unknown>,
    requestKey: string,
  ) {
    const request = requestIdentity(companyId, actorId, "activity", input, requestKey);
    const customerId = await this.resolveActivityCustomer(companyId, input);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${request.id}, 0))::text`;
      const existing = await tx.crmActivity.findFirst({ where: { id: request.id, companyId } });
      if (existing) {
        await checkReplay(tx, request.id, request.hash);
        return existing;
      }
      const created = await tx.crmActivity.create({
        data: {
          id: request.id,
          companyId,
          customerId,
          contactId: nullableUuid(input.contact_id),
          prospectId: nullableUuid(input.prospect_id),
          opportunityId: nullableUuid(input.opportunity_id),
          kind: String(input.kind) as never,
          occurredAt: new Date(String(input.occurred_at)),
          summary: String(input.summary).trim(),
          outcome: nullable(input.outcome),
          nextAction: nullable(input.next_action),
          nextActionAt: dateTimeOrNull(input.next_action_at),
          createdById: actorId,
        },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.activity.created",
        resourceType: "crm_activity",
        resourceId: created.id,
        after: { kind: created.kind, customerId, summary: created.summary },
        metadata: { request_hash: request.hash },
      });
      return created;
    });
  }

  async listActivities(companyId: string, resourceId: string, resourceType?: string) {
    const where: Prisma.CrmActivityWhereInput = { companyId };
    if (resourceType === "customer") where.customerId = resourceId;
    else if (resourceType === "contact") where.contactId = resourceId;
    else if (resourceType === "prospect") where.prospectId = resourceId;
    else if (resourceType === "opportunity") where.opportunityId = resourceId;
    else throw new NotFoundException("Jenis sumber aktivitas tidak tersedia.");
    return prisma.crmActivity.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    });
  }

  async registerAttachment(
    companyId: string,
    actorId: string,
    input: Record<string, unknown>,
    requestKey: string,
  ) {
    const objectKey = String(input.object_key).trim();
    if (!objectKey.startsWith(`${companyId}/`) || objectKey.includes(".."))
      throw new ConflictException("Lokasi lampiran tidak valid untuk perusahaan ini.");
    await this.assertAttachmentResource(
      companyId,
      String(input.resource_type),
      String(input.resource_id),
    );
    const request = requestIdentity(companyId, actorId, "attachment", input, requestKey);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${request.id}, 0))::text`;
      const existing = await tx.attachment.findFirst({ where: { id: request.id, companyId } });
      if (existing) {
        await checkReplay(tx, request.id, request.hash);
        return existing;
      }
      const created = await tx.attachment.create({
        data: {
          id: request.id,
          companyId,
          resourceType: String(input.resource_type),
          resourceId: String(input.resource_id),
          objectKey,
          originalName: String(input.original_name).trim(),
          mimeType: String(input.mime_type).trim().toLowerCase(),
          sizeBytes: BigInt(Number(input.size_bytes)),
          sha256: nullable(input.sha256),
          createdById: actorId,
        },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.attachment.registered",
        resourceType: "attachment",
        resourceId: created.id,
        after: {
          resourceType: created.resourceType,
          resourceId: created.resourceId,
          scanState: created.scanState,
        },
        metadata: { request_hash: request.hash },
      });
      return created;
    });
  }

  async createQuote(
    companyId: string,
    actorId: string,
    input: Record<string, unknown>,
    requestKey: string,
  ) {
    const customerId = String(input.customer_id);
    const prospectId = nullableUuid(input.prospect_id);
    const opportunityId = nullableUuid(input.opportunity_id);
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) throw new NotFoundException("Pelanggan tidak ditemukan dalam perusahaan aktif.");
    if (prospectId) {
      const prospect = await prisma.prospect.findFirst({
        where: { id: prospectId, companyId, customerId },
      });
      if (!prospect)
        throw new ConflictException("Prospek tidak terkait dengan pelanggan penawaran.");
    }
    if (opportunityId) {
      const opportunity = await prisma.opportunity.findFirst({
        where: { id: opportunityId, companyId, customerId },
      });
      if (!opportunity)
        throw new ConflictException("Peluang tidak terkait dengan pelanggan penawaran.");
    }
    const lines = (input.lines as Array<Record<string, unknown>>) ?? [];
    const productIds = lines
      .map((line) => nullableUuid(line.product_id))
      .filter((v): v is string => Boolean(v));
    const uomIds = lines.map((line) => String(line.uom_id));
    const sourceNeedIds = lines
      .map((line) => nullableUuid(line.source_need_id))
      .filter((v): v is string => Boolean(v));
    const [products, uoms, sourceNeeds] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true },
      }),
      prisma.uom.findMany({ where: { companyId, id: { in: uomIds } }, select: { id: true } }),
      sourceNeedIds.length
        ? prisma.prospectNeed.findMany({
            where: { id: { in: sourceNeedIds }, companyId },
            select: { id: true, prospect: { select: { customerId: true } } },
          })
        : [],
    ]);
    if (products.length !== new Set(productIds).size || uoms.length !== new Set(uomIds).size)
      throw new NotFoundException("Produk atau satuan penawaran tidak ditemukan.");
    if (
      sourceNeeds.length !== new Set(sourceNeedIds).size ||
      sourceNeeds.some((need) => need.prospect.customerId !== customerId)
    )
      throw new ConflictException("Kebutuhan sumber tidak terkait dengan pelanggan penawaran.");
    const request = requestIdentity(companyId, actorId, "quote", input, requestKey);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${request.id}, 0))::text`;
      const existing = await tx.quote.findFirst({
        where: { id: request.id, companyId },
        include: quoteInclude,
      });
      if (existing) {
        await checkReplay(tx, request.id, request.hash);
        return existing;
      }
      const code = await this.nextCode(tx, companyId, "quote");
      const created = await tx.quote.create({
        data: {
          id: request.id,
          companyId,
          customerId,
          prospectId,
          opportunityId,
          code,
          validUntil: input.valid_until
            ? new Date(`${String(input.valid_until)}T00:00:00.000Z`)
            : null,
          currency: String(input.currency ?? "IDR"),
          notes: nullable(input.notes),
          createdById: actorId,
          updatedById: actorId,
          lines: {
            create: lines.map((line) => {
              const quantity = new Prisma.Decimal(String(line.quantity));
              const unitPrice =
                line.unit_price == null ? null : new Prisma.Decimal(String(line.unit_price));
              const discount =
                line.discount == null ? null : new Prisma.Decimal(String(line.discount));
              if (quantity.lte(0) || (unitPrice && unitPrice.lt(0)) || (discount && discount.lt(0)))
                throw new ConflictException("Jumlah, harga, dan diskon tidak boleh negatif.");
              const gross = unitPrice ? quantity.mul(unitPrice) : null;
              const netAmount = gross && discount ? gross.sub(discount) : gross;
              if (netAmount && netAmount.lt(0))
                throw new ConflictException("Diskon melebihi nilai bruto.");
              return {
                companyId,
                sourceNeedId: nullableUuid(line.source_need_id),
                productId: nullableUuid(line.product_id),
                description: nullable(line.description),
                quantity,
                uomId: String(line.uom_id),
                unitPrice,
                discount,
                netAmount,
                createdById: actorId,
              };
            }),
          },
        },
        include: quoteInclude,
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.quote.created",
        resourceType: "quote",
        resourceId: created.id,
        after: { code, customerId, lineCount: lines.length, state: created.state },
        metadata: { request_hash: request.hash },
      });
      return created;
    });
  }

  async listQuotes(companyId: string, customerId?: string) {
    return prisma.quote.findMany({
      where: { companyId, ...(customerId ? { customerId } : {}) },
      include: quoteInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  async listAttachments(companyId: string, resourceType: string, resourceId: string) {
    await this.assertAttachmentResource(companyId, resourceType, resourceId);
    return prisma.attachment.findMany({
      where: { companyId, resourceType, resourceId, scanState: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
    });
  }

  private async resolveActivityCustomer(companyId: string, input: Record<string, unknown>) {
    const ids = {
      customer: nullableUuid(input.customer_id),
      contact: nullableUuid(input.contact_id),
      prospect: nullableUuid(input.prospect_id),
      opportunity: nullableUuid(input.opportunity_id),
    };
    const [customer, contact, prospect, opportunity] = await Promise.all([
      ids.customer ? prisma.customer.findFirst({ where: { id: ids.customer, companyId } }) : null,
      ids.contact
        ? prisma.contact.findFirst({ where: { id: ids.contact, companyId, state: "ACTIVE" } })
        : null,
      ids.prospect ? prisma.prospect.findFirst({ where: { id: ids.prospect, companyId } }) : null,
      ids.opportunity
        ? prisma.opportunity.findFirst({ where: { id: ids.opportunity, companyId } })
        : null,
    ]);
    if (
      (ids.customer && !customer) ||
      (ids.contact && !contact) ||
      (ids.prospect && !prospect) ||
      (ids.opportunity && !opportunity)
    )
      throw new NotFoundException("Sumber aktivitas tidak ditemukan dalam perusahaan aktif.");
    const customerIds = [
      customer?.id,
      contact?.customerId,
      prospect?.customerId,
      opportunity?.customerId,
    ].filter(Boolean);
    if (new Set(customerIds).size > 1)
      throw new ConflictException("Semua tautan aktivitas harus berasal dari pelanggan yang sama.");
    return customerIds[0] ?? null;
  }

  private async assertAttachmentResource(
    companyId: string,
    resourceType: string,
    resourceId: string,
  ) {
    const exists =
      resourceType === "customer"
        ? await prisma.customer.count({ where: { id: resourceId, companyId } })
        : resourceType === "contact"
          ? await prisma.contact.count({ where: { id: resourceId, companyId } })
          : resourceType === "prospect"
            ? await prisma.prospect.count({ where: { id: resourceId, companyId } })
            : resourceType === "opportunity"
              ? await prisma.opportunity.count({ where: { id: resourceId, companyId } })
              : resourceType === "activity"
                ? await prisma.crmActivity.count({ where: { id: resourceId, companyId } })
                : 0;
    if (!exists)
      throw new NotFoundException("Sumber lampiran tidak ditemukan dalam perusahaan aktif.");
  }

  async updateProspectStatus(
    companyId: string,
    actorId: string,
    id: string,
    version: number,
    status: string,
    notes?: string | null,
  ) {
    if (["DEFERRED", "DROPPED"].includes(status) && !notes?.trim())
      throw new ConflictException("Alasan wajib diisi untuk status ini.");
    return prisma.$transaction(async (tx) => {
      const current = await tx.prospect.findFirst({ where: { id, companyId, version } });
      if (!current)
        throw new PreconditionFailedException("Prospek sudah berubah atau tidak ditemukan.");
      const result = await tx.prospect.updateMany({
        where: { id, companyId, version },
        data: {
          approachStatus: status as never,
          ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      if (result.count !== 1)
        throw new PreconditionFailedException(
          "Prospek sudah berubah. Muat ulang sebelum menyimpan.",
        );
      const updated = await tx.prospect.findFirstOrThrow({
        where: { id, companyId },
        include: prospectInclude,
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.prospect.status_changed",
        resourceType: "prospect",
        resourceId: id,
        before: { status: current.approachStatus, version: current.version },
        after: { status: updated.approachStatus, version: updated.version },
        ...(notes ? { reason: notes } : {}),
      });
      return updated;
    });
  }

  async createOpportunity(
    companyId: string,
    actorId: string,
    input: Record<string, unknown>,
    requestKey?: string,
  ) {
    const request = requestIdentity(companyId, actorId, "opportunity", input, requestKey);
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${request.id}, 0))::text`;
        const existing = await tx.opportunity.findFirst({
          where: { id: request.id, companyId },
          include: opportunityInclude,
        });
        if (existing) {
          await checkReplay(tx, request.id, request.hash);
          return existing;
        }
        const prospectId = String(input.prospect_id);
        const prospect = await tx.prospect.findFirst({
          where: { id: prospectId, companyId },
          include: { customer: true, needs: true },
        });
        if (!prospect)
          throw new NotFoundException("Prospek tidak ditemukan dalam perusahaan aktif.");
        const sourceNeedIds = (input.source_need_ids as string[]) ?? [];
        const needs = prospect.needs.filter((need) => sourceNeedIds.includes(need.id));
        if (needs.length !== sourceNeedIds.length)
          throw new ConflictException("Kebutuhan harus berasal dari prospek yang sama.");
        const contactIds = (input.contact_ids as string[]) ?? [];
        const contacts = contactIds.length
          ? await tx.contact.findMany({
              where: {
                companyId,
                customerId: prospect.customerId,
                id: { in: contactIds },
                state: "ACTIVE",
              },
              select: { id: true },
            })
          : [];
        if (contacts.length !== contactIds.length)
          throw new ConflictException("Kontak harus aktif dan terkait dengan institusi prospek.");
        const code = await this.nextCode(tx, companyId, "opportunity");
        const created = await tx.opportunity.create({
          data: {
            id: request.id,
            companyId,
            prospectId,
            customerId: prospect.customerId,
            code,
            period: String(input.period),
            notes: nullable(input.notes),
            ownerId: prospect.ownerId,
            contactIds: contactIds as Prisma.InputJsonValue,
            createdById: actorId,
            updatedById: actorId,
            lines: {
              create: needs.map((need) => ({
                companyId,
                sourceNeedId: need.id,
                productId: need.productId,
                description: need.description,
                estimatedQty: need.estimatedQty,
                uomId: need.uomId,
                notes: need.notes,
                createdById: actorId,
              })),
            },
          },
          include: opportunityInclude,
        });
        await this.audit.recordWith(tx, {
          companyId,
          actorId,
          action: "crm.opportunity.created",
          resourceType: "opportunity",
          resourceId: created.id,
          after: { code, prospectId, period: created.period },
          metadata: { request_hash: request.hash },
        });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("Nomor peluang sudah digunakan.");
      throw error;
    }
  }

  async createCustomerOrder(
    companyId: string,
    actorId: string,
    input: Record<string, unknown>,
    key: string,
  ) {
    const request = requestIdentity(companyId, actorId, "customer-order", input, key);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${request.id}, 0))::text`;
      const existing = await tx.customerOrder.findFirst({
        where: { id: request.id, companyId },
        include: { opportunity: true },
      });
      if (existing) {
        await checkReplay(tx, request.id, request.hash);
        return existing;
      }
      const opportunity = await tx.opportunity.findFirst({
        where: { id: String(input.opportunity_id), companyId },
      });
      if (!opportunity)
        throw new NotFoundException("Peluang tidak ditemukan dalam perusahaan aktif.");
      const evidence = (input.evidence_attachment_ids as string[] | undefined) ?? [];
      if (evidence.length) {
        const count = await tx.attachment.count({
          where: { companyId, id: { in: evidence }, scanState: "AVAILABLE" },
        });
        if (count !== evidence.length)
          throw new ConflictException("Bukti PO/SP belum tersedia atau belum lolos pemeriksaan.");
      }
      const order = await tx.customerOrder.create({
        data: {
          id: request.id,
          companyId,
          customerId: opportunity.customerId,
          opportunityId: opportunity.id,
          kind: String(input.kind) as never,
          referenceNo: String(input.reference_no).trim(),
          evidenceAttachmentIds: evidence as Prisma.InputJsonValue,
          createdById: actorId,
        },
        include: { opportunity: true },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.customer_order.created",
        resourceType: "customer_order",
        resourceId: order.id,
        after: { opportunityId: opportunity.id, kind: order.kind, referenceNo: order.referenceNo },
        metadata: { request_hash: request.hash },
      });
      return order;
    });
  }

  async verifyCustomerOrder(companyId: string, actorId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findFirst({ where: { id, companyId } });
      if (!order) throw new NotFoundException("PO/SP pelanggan tidak ditemukan.");
      if (order.state === "VERIFIED") return order;
      const updated = await tx.customerOrder.update({
        where: { id },
        data: { state: "VERIFIED", verifiedAt: new Date(), verifiedById: actorId },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.customer_order.verified",
        resourceType: "customer_order",
        resourceId: id,
        before: { state: order.state },
        after: { state: updated.state },
      });
      return updated;
    });
  }

  async winOpportunity(
    companyId: string,
    actorId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    return prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.findFirst({
        where: { id, companyId },
        include: { lines: true, outcome: true },
      });
      if (!opportunity)
        throw new NotFoundException("Peluang tidak ditemukan dalam perusahaan aktif.");
      if (opportunity.state !== "OPEN" && opportunity.state !== "DRAFT")
        throw new ConflictException("Peluang sudah ditutup.");
      if (opportunity.version !== Number(input.version))
        throw new PreconditionFailedException("Peluang berubah. Muat ulang sebelum menyimpan.");
      const order = await tx.customerOrder.findFirst({
        where: {
          id: String(input.customer_order_id),
          companyId,
          opportunityId: id,
          customerId: opportunity.customerId,
          state: "VERIFIED",
        },
      });
      if (!order)
        throw new ConflictException(
          "Win hanya dapat dicatat dengan PO/SP pelanggan yang sudah diverifikasi.",
        );
      const rows = (input.lines as Array<Record<string, unknown>>) ?? [];
      const seen = new Set<string>();
      const data = rows.map((row) => {
        const line = opportunity.lines.find(
          (candidate) => candidate.id === row.opportunity_line_id,
        );
        const quantity = new Prisma.Decimal(String(row.quantity));
        if (
          !line ||
          seen.has(String(row.opportunity_line_id)) ||
          quantity.lessThanOrEqualTo(0) ||
          (line.estimatedQty && quantity.greaterThan(line.estimatedQty))
        )
          throw new ConflictException(
            "Jumlah Win melebihi kebutuhan peluang atau baris tidak valid.",
          );
        seen.add(line.id);
        return { companyId, lineId: line.id, quantity };
      });
      if (!data.length) throw new ConflictException("Minimal satu baris harus dimenangkan.");
      const outcome = await tx.opportunityOutcome.create({
        data: {
          companyId,
          opportunityId: id,
          kind: "WON",
          customerOrderId: order.id,
          maintainStrategy: String(input.maintain_strategy).trim(),
          createdById: actorId,
          lines: { create: data },
        },
        include: { lines: true, customerOrder: true },
      });
      await tx.opportunity.update({
        where: { id },
        data: { state: "CLOSED_WON", version: { increment: 1 }, updatedById: actorId },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.opportunity.won",
        resourceType: "opportunity",
        resourceId: id,
        after: { customerOrderId: order.id, lineCount: data.length },
      });
      return outcome;
    });
  }

  async loseOpportunity(
    companyId: string,
    actorId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    return prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.findFirst({
        where: { id, companyId },
        include: { outcome: true },
      });
      if (!opportunity)
        throw new NotFoundException("Peluang tidak ditemukan dalam perusahaan aktif.");
      if (opportunity.state !== "OPEN" && opportunity.state !== "DRAFT")
        throw new ConflictException("Peluang sudah ditutup.");
      if (opportunity.version !== Number(input.version))
        throw new PreconditionFailedException("Peluang berubah. Muat ulang sebelum menyimpan.");
      const outcome = await tx.opportunityOutcome.create({
        data: {
          companyId,
          opportunityId: id,
          kind: "LOST",
          reason: String(input.reason).trim(),
          maintainStrategy: input.maintain_strategy ? String(input.maintain_strategy).trim() : null,
          createdById: actorId,
        },
      });
      await tx.opportunity.update({
        where: { id },
        data: { state: "CLOSED_LOST", version: { increment: 1 }, updatedById: actorId },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.opportunity.lost",
        resourceType: "opportunity",
        resourceId: id,
        after: { reason: outcome.reason },
      });
      return outcome;
    });
  }

  private async validateNeeds(companyId: string, needs: Array<Record<string, unknown>>) {
    const productIds = needs
      .map((need) => nullableUuid(need.product_id))
      .filter((id): id is string => Boolean(id));
    const uomIds = needs
      .map((need) => nullableUuid(need.uom_id))
      .filter((id): id is string => Boolean(id));
    const [products, uoms] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true, baseUomId: true },
      }),
      prisma.uom.findMany({ where: { companyId, id: { in: uomIds } }, select: { id: true } }),
    ]);
    if (products.length !== new Set(productIds).size || uoms.length !== new Set(uomIds).size) {
      throw new NotFoundException(
        "Produk atau satuan kebutuhan tidak ditemukan dalam perusahaan aktif.",
      );
    }
    for (const need of needs) {
      const qty = decimalOrNull(need.estimated_qty);
      if (
        qty &&
        (qty.lessThanOrEqualTo(0) ||
          qty.decimalPlaces() > 10 ||
          qty.greaterThanOrEqualTo("100000000000000"))
      )
        throw new ConflictException(
          "Estimasi jumlah harus positif, maksimal 14 digit bulat dan 10 desimal.",
        );
      if (need.product_id && need.uom_id) {
        const product = products.find((p) => p.id === need.product_id);
        if (product?.baseUomId !== need.uom_id) {
          const conversion = await prisma.productUom.findFirst({
            where: {
              companyId,
              productId: String(need.product_id),
              uomId: String(need.uom_id),
              active: true,
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
            },
          });
          if (!conversion)
            throw new ConflictException(
              "Satuan kebutuhan tidak berlaku untuk produk yang dipilih.",
            );
        }
      }
    }
  }

  async addNeeds(
    companyId: string,
    actorId: string,
    id: string,
    input: { version: number; needs: Array<Record<string, unknown>> },
    key: string,
  ) {
    const request = requestIdentity(companyId, actorId, `needs:${id}`, input, key);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${request.id}, 0))::text`;
      const replay = await tx.auditEvent.findFirst({
        where: { companyId, resourceId: request.id, action: "crm.prospect.needs_added" },
      });
      if (replay) {
        if ((replay.metadata as Record<string, unknown>)?.request_hash !== request.hash)
          throw new ConflictException("Kunci permintaan sudah dipakai dengan data berbeda.");
        return tx.prospect.findFirstOrThrow({ where: { companyId, id }, include: prospectInclude });
      }
      await this.validateNeeds(companyId, input.needs);
      const updated = await tx.prospect.updateMany({
        where: { companyId, id, version: input.version },
        data: { version: { increment: 1 }, updatedById: actorId },
      });
      if (updated.count !== 1)
        throw new PreconditionFailedException(
          "Prospek berubah atau tidak ditemukan. Muat ulang sebelum menyimpan.",
        );
      for (const need of input.needs)
        await tx.prospectNeed.create({
          data: {
            companyId,
            prospectId: id,
            productId: nullableUuid(need.product_id),
            description: nullable(need.description),
            estimatedQty: decimalOrNull(need.estimated_qty),
            uomId: nullableUuid(need.uom_id),
            neededOn: dateOrNull(need.needed_on),
            neededPeriod: nullable(need.needed_period),
            notes: nullable(need.notes),
            createdById: actorId,
          },
        });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "crm.prospect.needs_added",
        resourceType: "prospect",
        resourceId: request.id,
        after: { prospectId: id, count: input.needs.length, version: input.version + 1 },
        metadata: { request_hash: request.hash },
      });
      return tx.prospect.findFirstOrThrow({ where: { companyId, id }, include: prospectInclude });
    });
  }

  private async nextCode(
    tx: Prisma.TransactionClient,
    companyId: string,
    entityType: "contact" | "prospect" | "opportunity" | "customer" | "quote",
  ) {
    const policies = await tx.systemPolicy.findMany({
      where: { companyId, code: "OPS-WH-04", ownerDomain: "master", policyGroup: "warehouse" },
      include: {
        versions: {
          where: {
            state: "ACTIVE",
            OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }],
          },
          orderBy: { versionNo: "desc" },
          take: 1,
        },
      },
    });
    const policy = policies.find((candidate) => {
      const value = candidate.versions[0]?.valueSnapshot;
      return Boolean(
        value && typeof value === "object" && !Array.isArray(value) && "sequence_length" in value,
      );
    });
    const value = policy?.versions[0]?.valueSnapshot;
    const data =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    const prefix = typeof data?.[entityType] === "string" ? data[entityType].trim() : "";
    const length = Number(data?.sequence_length);
    if (!prefix || !Number.isInteger(length) || length < 1 || length > 12)
      throw new ConflictException(
        "Policy kode CRM belum lengkap. Perbaiki melalui Setting → Kebijakan Operasional.",
      );
    await tx.masterCodeSequence.upsert({
      where: { companyId_entityType: { companyId, entityType } },
      create: { companyId, entityType, nextValue: 1n },
      update: {},
    });
    await tx.$queryRaw`SELECT id FROM master_code_sequences WHERE company_id = ${companyId}::uuid AND entity_type = ${entityType} FOR UPDATE`;
    const sequence = await tx.masterCodeSequence.findUniqueOrThrow({
      where: { companyId_entityType: { companyId, entityType } },
    });
    await tx.masterCodeSequence.update({
      where: { id: sequence.id },
      data: { nextValue: sequence.nextValue + 1n },
    });
    return `${prefix}-${sequence.nextValue.toString().padStart(length, "0")}`;
  }
}

function requestIdentity(
  companyId: string,
  actorId: string,
  kind: string,
  input: unknown,
  key?: string,
) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const hex = createHash("sha256")
    .update(`${companyId}:${actorId}:${kind}:${key ?? randomUUID()}`)
    .digest("hex");
  return {
    id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
    hash,
  };
}
async function checkReplay(tx: Prisma.TransactionClient, id: string, hash: string) {
  const event = await tx.auditEvent.findFirst({
    where: {
      resourceId: id,
      action: { in: ["crm.contact.created", "crm.prospect.created", "crm.opportunity.created"] },
    },
    select: { metadata: true },
  });
  const metadata = event?.metadata as Record<string, unknown> | undefined;
  if (metadata?.request_hash !== hash)
    throw new ConflictException(
      "Kunci permintaan sudah dipakai dengan data berbeda. Muat ulang formulir.",
    );
}

function nullable(value: unknown) {
  return value === null || value === undefined || String(value).trim() === ""
    ? null
    : String(value).trim();
}
function nullableUuid(value: unknown) {
  const normalized = nullable(value);
  return normalized;
}
function decimalOrNull(value: unknown) {
  const normalized = nullable(value);
  return normalized ? new Prisma.Decimal(normalized) : null;
}
function dateOrNull(value: unknown) {
  const normalized = nullable(value);
  return normalized ? new Date(`${normalized}T00:00:00.000Z`) : null;
}
function dateTimeOrNull(value: unknown) {
  const normalized = nullable(value);
  return normalized ? new Date(normalized) : null;
}
function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
