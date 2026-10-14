import { BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma, type Prisma } from "@evflow/database";
import type { CrmListQuery } from "@evflow/contracts";

// Explicit projection: CRM never serializes tax identity, credit, or master audit fields.
export const customerSelect = {
  id: true,
  code: true,
  name: true,
  primaryAddress: true,
  relationshipStage: true,
  onboardingState: true,
  state: true,
  channel: { select: { name: true } },
  rayon: { select: { name: true } },
} satisfies Prisma.CustomerSelect;
export const prospectInclude = {
  customer: { select: customerSelect },
  needs: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      uom: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ProspectInclude;
export const contactInclude = {
  customer: { select: customerSelect },
} satisfies Prisma.ContactInclude;
export const opportunityInclude = {
  customer: { select: customerSelect },
  outcome: { include: { lines: true, customerOrder: true } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      uom: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.OpportunityInclude;
export const quoteInclude = {
  customer: { select: customerSelect },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      uom: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.QuoteInclude;
const statuses = ["NEW", "IN_PROGRESS", "POTENTIAL", "DEFERRED", "DROPPED"];

export async function crmPage(companyId: string, resource: string, query: CrmListQuery) {
  const { q, status, page, sort } = query;
  const contains = { contains: q, mode: "insensitive" as const };
  const pagination = { take: 20, skip: (page - 1) * 20 };
  if (resource === "prospects") {
    if (status !== "all" && !statuses.includes(status))
      throw new BadRequestException("Status prospek tidak valid.");
    const where: Prisma.ProspectWhereInput = {
      companyId,
      ...(status === "all" ? {} : { approachStatus: status as never }),
      ...(q ? { OR: [{ code: contains }, { customer: { name: contains } }] } : {}),
    };
    const [rows, total] = await prisma.$transaction(
      [
        prisma.prospect.findMany({
          where,
          include: prospectInclude,
          ...pagination,
          orderBy:
            sort === "name"
              ? [{ customer: { name: "asc" } }, { id: "asc" }]
              : [{ updatedAt: "desc" }, { id: "asc" }],
        }),
        prisma.prospect.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    const owners = await prisma.companyMembership.findMany({
      where: { companyId, userId: { in: rows.map((r) => r.ownerId) } },
      select: { user: { select: { id: true, displayName: true } } },
    });
    return {
      data: rows.map((r) => ({
        ...r,
        ownerName:
          owners.find((o) => o.user.id === r.ownerId)?.user.displayName ??
          "Pengguna tidak tersedia",
      })),
      total,
      page,
      pageSize: 20,
    };
  }
  if (resource === "contacts") {
    if (!["all", "ACTIVE", "INACTIVE"].includes(status))
      throw new BadRequestException("Status kontak tidak valid.");
    const where: Prisma.ContactWhereInput = {
      companyId,
      ...(status === "all" ? {} : { state: status as never }),
      ...(q
        ? { OR: [{ fullName: contains }, { code: contains }, { customer: { name: contains } }] }
        : {}),
    };
    const [data, total] = await prisma.$transaction(
      [
        prisma.contact.findMany({
          where,
          include: contactInclude,
          ...pagination,
          orderBy:
            sort === "name"
              ? [{ fullName: "asc" }, { id: "asc" }]
              : [{ updatedAt: "desc" }, { id: "asc" }],
        }),
        prisma.contact.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { data, total, page, pageSize: 20 };
  }
  if (resource === "customers") {
    if (!["all", "DRAFT", "ACTIVE", "INACTIVE"].includes(status))
      throw new BadRequestException("Status master tidak valid.");
    const where: Prisma.CustomerWhereInput = {
      companyId,
      ...(status === "all" ? {} : { state: status as never }),
      ...(q ? { OR: [{ name: contains }, { code: contains }] } : {}),
    };
    const [data, total] = await prisma.$transaction(
      [
        prisma.customer.findMany({
          where,
          select: customerSelect,
          ...pagination,
          orderBy: [{ name: "asc" }, { id: "asc" }],
        }),
        prisma.customer.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { data, total, page, pageSize: 20 };
  }
  throw new BadRequestException("Jenis data CRM tidak tersedia.");
}

export async function crmDetail(
  companyId: string,
  resource: "prospects" | "contacts" | "customers",
  id: string,
  includeContacts = true,
) {
  if (resource === "contacts") {
    const row = await prisma.contact.findFirst({
      where: { companyId, id },
      include: contactInclude,
    });
    if (!row) throw new NotFoundException("Kontak tidak ditemukan.");
    return row;
  }
  const customer =
    resource === "customers"
      ? await prisma.customer.findFirst({ where: { companyId, id }, select: customerSelect })
      : null;
  const prospect =
    resource === "prospects"
      ? await prisma.prospect.findFirst({ where: { companyId, id }, include: prospectInclude })
      : null;
  if (!customer && !prospect) throw new NotFoundException("Data tidak ditemukan.");
  const customerId = customer?.id ?? prospect!.customerId;
  const contacts = includeContacts
    ? await prisma.contact.findMany({
        where: { companyId, customerId },
        include: contactInclude,
        orderBy: { fullName: "asc" },
      })
    : undefined;
  const owner = prospect
    ? await prisma.companyMembership.findFirst({
        where: { companyId, userId: prospect.ownerId },
        select: { user: { select: { displayName: true } } },
      })
    : null;
  return {
    ...(customer ?? prospect),
    ...(prospect ? { ownerName: owner?.user.displayName ?? "Pengguna tidak tersedia" } : {}),
    ...(contacts ? { contacts } : {}),
  };
}

export async function crmSummary(companyId: string) {
  const today = new Date();
  // Company timezone baseline is WITA. Count due up to the end of today's WITA date.
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const cutoff = new Date(`${day}T23:59:59.999+08:00`);
  const activeWhere: Prisma.ProspectWhereInput = {
    companyId,
    approachStatus: { notIn: ["DEFERRED", "DROPPED"] },
  };
  const [active, followUp] = await prisma.$transaction(
    [
      prisma.prospect.count({ where: activeWhere }),
      prisma.prospect.count({
        where: { ...activeWhere, nextAction: { not: null }, nextActionAt: { lte: cutoff } },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return { active, followUp, opportunities: null, quotes: null };
}
