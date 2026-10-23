import { NotFoundException } from "@nestjs/common";
import { prisma } from "@evflow/database";
import { z } from "zod";

// Daftar, detail dan riwayat bersama untuk submenu Master Data selain Pelanggan dan Produk.
export const workspaceResources = [
  "suppliers",
  "vendors",
  "warehouses",
  "locators",
  "operational-items",
  "product-categories",
  "uoms",
  "customer-channels",
  "rayons",
] as const;
export type WorkspaceResource = (typeof workspaceResources)[number];
export const workspaceResourceSchema = z.enum(workspaceResources);
// Produk memakai detail/riwayat khususnya; hanya daftar berhalaman yang dilayani di sini.
export const listResourceSchema = z.enum([...workspaceResources, "products"]);
export type ListResource = z.infer<typeof listResourceSchema>;

export const masterPageSize = 20;
export const masterListSchema = z
  .object({
    q: z.string().trim().max(150).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    state: z.enum(["ALL", "DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ALL"),
    parent: z.union([z.literal("ALL"), z.string().uuid()]).default("ALL"),
  })
  .strict();
export type MasterListQuery = z.infer<typeof masterListSchema>;

// Audit lama memakai resourceType tunggal saat create dan jamak saat activate/deactivate.
const auditTypes: Record<WorkspaceResource, string[]> = {
  suppliers: ["supplier", "suppliers"],
  vendors: ["vendor", "vendors"],
  warehouses: ["warehouse", "warehouses"],
  locators: ["locator", "locators"],
  "operational-items": ["operational_item", "operational-items"],
  "product-categories": ["product-categories"],
  uoms: ["uoms"],
  "customer-channels": ["customer-channels"],
  rayons: ["rayons"],
};

export function masterWhere(companyId: string, resource: ListResource, q: MasterListQuery) {
  const contains = { contains: q.q, mode: "insensitive" as const };
  return {
    companyId,
    ...(q.q ? { OR: [{ code: contains }, { name: contains }] } : {}),
    ...(q.state !== "ALL" ? { state: q.state } : {}),
    ...(resource === "locators" && q.parent !== "ALL" ? { warehouseId: q.parent } : {}),
    ...(resource === "products" && q.parent !== "ALL" ? { categoryId: q.parent } : {}),
  };
}

const order = [{ name: "asc" as const }, { id: "asc" as const }];

const referenceSelect = {
  id: true,
  code: true,
  name: true,
  state: true,
  version: true,
  updatedAt: true,
};

export async function masterPage(companyId: string, resource: ListResource, input: unknown) {
  const q = masterListSchema.parse(input);
  const where = masterWhere(companyId, resource, q);
  const page = { orderBy: order, take: masterPageSize, skip: (q.page - 1) * masterPageSize };
  const [data, total] = await prisma.$transaction(
    async (tx) => {
      switch (resource) {
        case "suppliers":
          return Promise.all([
            tx.supplier.findMany({
              where,
              ...page,
              select: {
                id: true,
                code: true,
                name: true,
                categories: true,
                phone: true,
                salesContact: true,
                state: true,
                updatedAt: true,
              },
            }),
            tx.supplier.count({ where }),
          ]);
        case "vendors":
          return Promise.all([
            tx.vendor.findMany({
              where,
              ...page,
              select: {
                id: true,
                code: true,
                name: true,
                vendorType: true,
                categories: true,
                phone: true,
                email: true,
                state: true,
                updatedAt: true,
              },
            }),
            tx.vendor.count({ where }),
          ]);
        case "warehouses":
          return Promise.all([
            tx.warehouse.findMany({
              where,
              ...page,
              select: {
                id: true,
                code: true,
                name: true,
                address: true,
                timezone: true,
                state: true,
                updatedAt: true,
                _count: { select: { locators: true } },
              },
            }),
            tx.warehouse.count({ where }),
          ]);
        case "locators":
          return Promise.all([
            tx.locator.findMany({
              where,
              ...page,
              select: {
                id: true,
                code: true,
                name: true,
                locatorType: true,
                pickSequence: true,
                state: true,
                updatedAt: true,
                warehouse: { select: { id: true, code: true, name: true } },
              },
            }),
            tx.locator.count({ where }),
          ]);
        case "operational-items":
          return Promise.all([
            tx.operationalItem.findMany({
              where,
              ...page,
              select: {
                id: true,
                code: true,
                name: true,
                kind: true,
                category: true,
                referencePurchasePrice: true,
                currency: true,
                stockControlled: true,
                state: true,
                updatedAt: true,
                baseUom: { select: { id: true, code: true, name: true } },
              },
            }),
            tx.operationalItem.count({ where }),
          ]);
        case "products":
          return Promise.all([
            tx.product.findMany({
              where,
              ...page,
              select: {
                id: true,
                code: true,
                name: true,
                state: true,
                updatedAt: true,
                category: { select: { id: true, name: true } },
                baseUom: { select: { id: true, code: true, name: true } },
                registrations: {
                  select: { status: true, expiresOn: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            }),
            tx.product.count({ where }),
          ]);
        case "product-categories":
          return Promise.all([
            tx.productCategory.findMany({
              where,
              ...page,
              select: { ...referenceSelect, _count: { select: { products: true } } },
            }),
            tx.productCategory.count({ where }),
          ]);
        case "uoms":
          return Promise.all([
            tx.uom.findMany({ where, ...page, select: referenceSelect }),
            tx.uom.count({ where }),
          ]);
        case "customer-channels":
          return Promise.all([
            tx.customerChannel.findMany({
              where,
              ...page,
              select: { ...referenceSelect, _count: { select: { customers: true } } },
            }),
            tx.customerChannel.count({ where }),
          ]);
        case "rayons":
          return Promise.all([
            tx.rayon.findMany({
              where,
              ...page,
              select: {
                ...referenceSelect,
                coverageNotes: true,
                _count: { select: { customers: true } },
              },
            }),
            tx.rayon.count({ where }),
          ]);
      }
    },
    { isolationLevel: "RepeatableRead" },
  );
  return { data, total, page: q.page, page_size: masterPageSize };
}

export async function masterDetail(companyId: string, resource: WorkspaceResource, id: string) {
  const where = { id, companyId };
  const row = await (() => {
    switch (resource) {
      case "suppliers":
        return prisma.supplier.findFirst({ where });
      case "vendors":
        return prisma.vendor.findFirst({ where });
      case "warehouses":
        return prisma.warehouse.findFirst({
          where,
          include: { _count: { select: { locators: true } } },
        });
      case "locators":
        return prisma.locator.findFirst({
          where,
          include: { warehouse: { select: { id: true, code: true, name: true } } },
        });
      case "operational-items":
        return prisma.operationalItem.findFirst({
          where,
          include: { baseUom: { select: { id: true, code: true, name: true } } },
        });
      case "product-categories":
        return prisma.productCategory.findFirst({
          where,
          include: { _count: { select: { products: true } } },
        });
      case "uoms":
        return prisma.uom.findFirst({ where });
      case "customer-channels":
        return prisma.customerChannel.findFirst({
          where,
          include: { _count: { select: { customers: true } } },
        });
      case "rayons":
        return prisma.rayon.findFirst({
          where,
          include: { _count: { select: { customers: true } } },
        });
    }
  })();
  if (!row) throw new NotFoundException("Data master tidak ditemukan.");
  return row;
}

export const duplicateCheckSchema = z
  .object({ name: z.string().trim().min(2).max(200), exclude_id: z.string().uuid().optional() })
  .strict();

// Kandidat duplikat sebelum create/ubah; unique constraint tetap pengaman terakhir.
export async function masterDuplicates(
  companyId: string,
  resource: WorkspaceResource,
  input: unknown,
) {
  const q = duplicateCheckSchema.parse(input);
  const normalized = q.name.toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
  const where = {
    companyId,
    ...(q.exclude_id ? { NOT: { id: q.exclude_id } } : {}),
    OR: [
      { normalizedName: normalized },
      { name: { contains: q.name, mode: "insensitive" as const } },
    ],
  };
  const args = { where, select: { id: true, code: true, name: true, state: true }, take: 10 };
  switch (resource) {
    case "suppliers":
      return prisma.supplier.findMany(args);
    case "vendors":
      return prisma.vendor.findMany(args);
    case "warehouses":
      return prisma.warehouse.findMany(args);
    case "locators":
      return prisma.locator.findMany(args);
    case "operational-items":
      return prisma.operationalItem.findMany(args);
    case "product-categories":
      return prisma.productCategory.findMany(args);
    case "uoms":
      return prisma.uom.findMany(args);
    case "customer-channels":
      return prisma.customerChannel.findMany(args);
    case "rayons":
      return prisma.rayon.findMany(args);
  }
}

export async function masterHistory(companyId: string, resource: WorkspaceResource, id: string) {
  await masterDetail(companyId, resource, id);
  return prisma.auditEvent.findMany({
    where: { companyId, resourceId: id, resourceType: { in: auditTypes[resource] } },
    select: {
      id: true,
      occurredAt: true,
      action: true,
      reason: true,
      actor: { select: { displayName: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
}
