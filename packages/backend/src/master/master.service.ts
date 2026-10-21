import { Prisma, prisma } from "@evflow/database";
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import { AuditService } from "../common/audit.service";

type MasterState = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

const entityTypes = {
  product: "product",
  customer: "customer",
  contact: "contact",
  supplier: "supplier",
  vendor: "vendor",
  operational_item: "operational_item",
  warehouse: "warehouse",
  locator: "locator",
  product_category: "product_category",
  uom: "uom",
  channel: "channel",
  rayon: "rayon",
} as const;

@Injectable()
export class MasterService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async listReference(companyId: string, resource: string, search?: string) {
    const term = search?.trim();
    const contains = term ? { contains: term, mode: "insensitive" as const } : undefined;
    switch (resource) {
      case "product-categories":
        return prisma.productCategory.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          orderBy: { name: "asc" },
        });
      case "uoms":
        return prisma.uom.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          orderBy: { name: "asc" },
        });
      case "customer-channels":
        return prisma.customerChannel.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          orderBy: { name: "asc" },
        });
      case "rayons":
        return prisma.rayon.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          orderBy: { name: "asc" },
        });
      default:
        throw new NotFoundException("Jenis data referensi tidak tersedia.");
    }
  }

  async listMasters(companyId: string, resource: string, search?: string) {
    const term = search?.trim();
    const contains = term ? { contains: term, mode: "insensitive" as const } : undefined;
    switch (resource) {
      case "products":
        return prisma.product.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          include: { category: true, baseUom: true, registrations: true, referencePrices: true },
          orderBy: { name: "asc" },
        });
      case "customers":
        return prisma.customer.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          include: { channel: true, rayon: true },
          orderBy: { name: "asc" },
        });
      case "suppliers":
        return prisma.supplier.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          orderBy: { name: "asc" },
        });
      case "vendors":
        return prisma.vendor.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          orderBy: { name: "asc" },
        });
      case "warehouses":
        return prisma.warehouse.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          include: { locators: true },
          orderBy: { name: "asc" },
        });
      case "locators":
        return prisma.locator.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          include: { warehouse: true },
          orderBy: [{ warehouse: { name: "asc" } }, { name: "asc" }],
        });
      case "operational-items":
        return prisma.operationalItem.findMany({
          where: { companyId, ...(contains ? { name: contains } : {}) },
          include: { baseUom: true },
          orderBy: { name: "asc" },
        });
      default:
        throw new NotFoundException("Jenis master tidak tersedia.");
    }
  }

  async createReference(
    companyId: string,
    actorId: string,
    resource: string,
    input: { code: string; name: string; coverage_notes?: string | null },
  ) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const normalizedName = normalize(name);
    try {
      return await prisma.$transaction(async (tx) => {
        let created: unknown;
        if (resource === "product-categories") {
          created = await tx.productCategory.create({
            data: {
              companyId,
              code,
              name,
              normalizedName,
              createdById: actorId,
              updatedById: actorId,
            },
          });
        } else if (resource === "uoms") {
          created = await tx.uom.create({
            data: {
              companyId,
              code,
              name,
              normalizedName,
              createdById: actorId,
              updatedById: actorId,
            },
          });
        } else if (resource === "customer-channels") {
          created = await tx.customerChannel.create({
            data: {
              companyId,
              code,
              name,
              normalizedName,
              createdById: actorId,
              updatedById: actorId,
            },
          });
        } else if (resource === "rayons") {
          created = await tx.rayon.create({
            data: {
              companyId,
              code,
              name,
              normalizedName,
              coverageNotes: input.coverage_notes ?? null,
              createdById: actorId,
              updatedById: actorId,
            },
          });
        } else {
          throw new NotFoundException("Jenis data referensi tidak tersedia.");
        }
        const record = created as { id: string };
        await this.audit.recordWith(tx, {
          companyId,
          actorId,
          action: "master.created",
          resourceType: resource,
          resourceId: record.id,
          after: { code, name },
        });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException("Kode atau nama data sudah digunakan.");
      throw error;
    }
  }

  async createProduct(companyId: string, actorId: string, input: Record<string, unknown>) {
    const name = String(input.name).trim();
    const categoryId = String(input.category_id);
    const baseUomId = String(input.base_uom_id);
    const code = await this.nextCode(companyId, entityTypes.product, actorId);
    const product = await prisma.$transaction(async (tx) => {
      const [category, uom] = await Promise.all([
        tx.productCategory.findFirst({ where: { id: categoryId, companyId, state: "ACTIVE" } }),
        tx.uom.findFirst({ where: { id: baseUomId, companyId, state: "ACTIVE" } }),
      ]);
      if (!category || !uom)
        throw new NotFoundException("Kategori atau satuan dasar tidak tersedia.");
      const created = await tx.product.create({
        data: {
          companyId,
          code,
          name,
          normalizedName: normalize(name),
          categoryId,
          baseUomId,
          batchRequired: Boolean(input.batch_required),
          expiryRequired: Boolean(input.expiry_required),
          serialRequired: Boolean(input.serial_required),
          storageNotes: nullable(input.storage_notes),
          storageProfile: jsonOrNull(input.storage_profile),
          shelfLifeDays: input.shelf_life_days == null ? null : Number(input.shelf_life_days),
          createdById: actorId,
          updatedById: actorId,
          uoms: {
            create: {
              companyId,
              uomId: baseUomId,
              factorToBase: new Prisma.Decimal("1"),
              createdById: actorId,
            },
          },
          ...(input.permit_number && input.permit_type && input.permit_holder
            ? {
                registrations: {
                  create: {
                    companyId,
                    permitType: String(input.permit_type),
                    permitNumber: String(input.permit_number),
                    holder: String(input.permit_holder),
                    issuedOn: input.permit_issued_on
                      ? new Date(String(input.permit_issued_on))
                      : null,
                    expiresOn: input.permit_expires_on
                      ? new Date(String(input.permit_expires_on))
                      : null,
                    status: String(input.permit_status ?? "PENDING") as never,
                    createdById: actorId,
                  },
                },
              }
            : {}),
          referencePrices: {
            createMany: {
              data: ["PURCHASE", "SALE"].flatMap((kind) => {
                const value = kind === "PURCHASE" ? input.purchase_price : input.sale_price;
                if (!value) return [];
                return [
                  {
                    companyId,
                    uomId: baseUomId,
                    kind: kind as "PURCHASE" | "SALE",
                    currency: String(input.price_currency ?? "IDR"),
                    unitPrice: new Prisma.Decimal(String(value)),
                    effectiveFrom: new Date(),
                    createdById: actorId,
                  },
                ];
              }),
            },
          },
        },
        include: { category: true, baseUom: true, registrations: true, referencePrices: true },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "master.product.created",
        resourceType: "product",
        resourceId: created.id,
        after: { code, name, state: created.state },
      });
      return created;
    });
    return product;
  }

  async getProduct(companyId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, companyId },
      include: {
        category: true,
        baseUom: true,
        uoms: { include: { uom: true } },
        registrations: true,
        referencePrices: {
          include: { uom: true },
          orderBy: [{ kind: "asc" }, { effectiveFrom: "desc" }],
        },
      },
    });
    if (!product) throw new NotFoundException("Produk tidak ditemukan.");
    const [stock, allocations, orderLines, purchaseLines] = await Promise.all([
      prisma.stockLot.aggregate({
        where: { companyId, productId: id },
        _sum: { quantityOnHand: true, quantityReserved: true },
      }),
      prisma.fulfillmentAllocation.aggregate({
        where: { fulfillmentBatch: { companyId }, salesOrderLine: { productId: id } },
        _sum: { quantity: true, acceptedQuantity: true },
      }),
      prisma.salesOrderLine.count({ where: { companyId, productId: id } }),
      prisma.purchaseOrderLine.count({ where: { productId: id, purchaseOrder: { companyId } } }),
    ]);
    return {
      ...product,
      integration: {
        stock_on_hand: stock._sum.quantityOnHand ?? new Prisma.Decimal(0),
        stock_reserved: stock._sum.quantityReserved ?? new Prisma.Decimal(0),
        allocated_quantity: allocations._sum.quantity ?? new Prisma.Decimal(0),
        accepted_quantity: allocations._sum.acceptedQuantity ?? new Prisma.Decimal(0),
        sales_order_lines: orderLines,
        purchase_order_lines: purchaseLines,
      },
    };
  }

  async updateProduct(
    companyId: string,
    actorId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const version = Number(input.version);
    const name = String(input.name).trim();
    const categoryId = String(input.category_id);
    const baseUomId = String(input.base_uom_id);
    return prisma.$transaction(async (tx) => {
      const current = await tx.product.findFirst({ where: { id, companyId, version } });
      if (!current) throw new PreconditionFailedException("Produk berubah atau tidak ditemukan.");
      const [category, uom] = await Promise.all([
        tx.productCategory.findFirst({ where: { id: categoryId, companyId, state: "ACTIVE" } }),
        tx.uom.findFirst({ where: { id: baseUomId, companyId, state: "ACTIVE" } }),
      ]);
      if (!category || !uom)
        throw new NotFoundException("Kategori atau satuan dasar tidak tersedia.");
      const updated = await tx.product.update({
        where: { id },
        data: {
          name,
          normalizedName: normalize(name),
          categoryId,
          baseUomId,
          batchRequired: Boolean(input.batch_required),
          expiryRequired: Boolean(input.expiry_required),
          serialRequired: Boolean(input.serial_required),
          storageNotes: nullable(input.storage_notes),
          storageProfile: jsonOrNull(input.storage_profile),
          shelfLifeDays: input.shelf_life_days == null ? null : Number(input.shelf_life_days),
          version: { increment: 1 },
          updatedById: actorId,
        },
        include: { category: true, baseUom: true, registrations: true, referencePrices: true },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "master.product.updated",
        resourceType: "product",
        resourceId: id,
        before: current,
        after: updated,
        metadata: { expected_version: version },
      });
      return updated;
    });
  }

  async addProductRegistration(
    companyId: string,
    actorId: string,
    productId: string,
    input: Record<string, unknown>,
  ) {
    return this.createWithAudit("product_registration", companyId, actorId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, companyId } });
      if (!product) throw new NotFoundException("Produk tidak ditemukan.");
      const created = await tx.productRegistration.create({
        data: {
          companyId,
          productId,
          permitType: String(input.permit_type),
          permitNumber: String(input.permit_number).trim(),
          holder: String(input.holder).trim(),
          issuedOn: input.issued_on ? new Date(String(input.issued_on)) : null,
          expiresOn: input.expires_on ? new Date(String(input.expires_on)) : null,
          evidenceObjectKey: nullable(input.evidence_object_key),
          status: "PENDING",
          createdById: actorId,
        },
      });
      return created;
    });
  }

  async verifyProductRegistration(
    companyId: string,
    actorId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    return prisma.$transaction(async (tx) => {
      const registration = await tx.productRegistration.findFirst({ where: { id, companyId } });
      if (!registration) throw new NotFoundException("Registrasi izin edar tidak ditemukan.");
      if (input.status === "VALID" && !registration.evidenceObjectKey)
        throw new ConflictException("BUKTI_IZIN_EDAR_REQUIRED");
      const updated = await tx.productRegistration.update({
        where: { id },
        data: {
          status: String(input.status) as never,
          dispositionById: actorId,
          dispositionAt: new Date(),
          dispositionReason: nullable(input.reason),
        },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "master.product_registration.verified",
        resourceType: "product_registration",
        resourceId: id,
        before: registration,
        after: updated,
        ...(nullable(input.reason) ? { reason: nullable(input.reason)! } : {}),
      });
      return updated;
    });
  }

  async addProductReferencePrice(
    companyId: string,
    actorId: string,
    productId: string,
    input: Record<string, unknown>,
  ) {
    return this.createWithAudit("product_reference_price", companyId, actorId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, companyId } });
      const uom = await tx.uom.findFirst({
        where: { id: String(input.uom_id), companyId, state: "ACTIVE" },
      });
      if (!product || !uom) throw new NotFoundException("Produk atau satuan tidak ditemukan.");
      const from = new Date(String(input.effective_from));
      const to = input.effective_to ? new Date(String(input.effective_to)) : null;
      if (to && to <= from) throw new ConflictException("PRICE_EFFECTIVE_RANGE_INVALID");
      const overlap = await tx.productReferencePrice.count({
        where: {
          companyId,
          productId,
          uomId: uom.id,
          kind: String(input.kind) as never,
          currency: String(input.currency),
          effectiveFrom: { lt: to ?? new Date("2999-12-31") },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }],
        },
      });
      if (overlap) throw new ConflictException("PRICE_POLICY_OVERLAP");
      return tx.productReferencePrice.create({
        data: {
          companyId,
          productId,
          uomId: uom.id,
          kind: String(input.kind) as never,
          currency: String(input.currency),
          unitPrice: new Prisma.Decimal(String(input.unit_price)),
          effectiveFrom: from,
          effectiveTo: to,
          createdById: actorId,
        },
        include: { uom: true },
      });
    });
  }

  private customerLegalDocuments(value: unknown, previous: unknown = []) {
    if (!Array.isArray(value)) return jsonOrNull(value);
    const old = Array.isArray(previous) ? previous : [];
    const identity = (item: Record<string, unknown>) =>
      JSON.stringify(
        Object.entries(item)
          .filter(([key]) => key !== "verification_state")
          .sort(([a], [b]) => a.localeCompare(b)),
      );
    return jsonOrNull(
      value.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const match = old.find(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            !Array.isArray(entry) &&
            identity(entry) === identity(item),
        );
        return { ...item, verification_state: match?.verification_state ?? "UNVERIFIED" };
      }),
    );
  }

  private async validateCustomerEvidence(companyId: string, input: Record<string, unknown>) {
    const documents = [
      ...(Array.isArray(input.legal_documents) ? input.legal_documents : []),
      input.noo_document,
    ];
    for (const document of documents) {
      if (!document || typeof document !== "object") continue;
      const id = (document as Record<string, unknown>).evidence_id;
      if (
        id &&
        (typeof id !== "string" ||
          !(await prisma.transactionEvidence.findFirst({
            where: { id, companyId, purpose: "CUSTOMER_MASTER" },
            select: { id: true },
          })))
      )
        throw new NotFoundException("Bukti pelanggan tidak ditemukan pada perusahaan ini.");
    }
  }

  async createCustomer(companyId: string, actorId: string, input: Record<string, unknown>) {
    const channelId = nullable(input.channel_id),
      rayonId = nullable(input.rayon_id);
    if (
      channelId &&
      !(await prisma.customerChannel.findFirst({
        where: { id: channelId, companyId, state: "ACTIVE" },
      }))
    )
      throw new NotFoundException("Channel pelanggan tidak ditemukan.");
    if (
      rayonId &&
      !(await prisma.rayon.findFirst({ where: { id: rayonId, companyId, state: "ACTIVE" } }))
    )
      throw new NotFoundException("Rayon pelanggan tidak ditemukan.");
    await this.validateCustomerEvidence(companyId, input);
    const name = String(input.name).trim();
    const code = await this.nextCode(companyId, entityTypes.customer, actorId);
    return this.createWithAudit("customer", companyId, actorId, async (tx) =>
      tx.customer.create({
        data: {
          companyId,
          code,
          name,
          normalizedName: normalize(name),
          legalName: nullable(input.legal_name),
          channelId: nullable(input.channel_id),
          rayonId: nullable(input.rayon_id),
          relationshipStage: String(input.relationship_stage ?? "PROSPECT") as never,
          primaryAddress: nullable(input.primary_address),
          shippingAddress: nullable(input.shipping_address),
          phone: nullable(input.phone),
          email: nullable(input.email),
          taxIdentity: nullable(input.tax_identity),
          taxStatus: nullable(input.tax_status),
          billingAddress: nullable(input.billing_address),
          customerType: nullable(input.customer_type),
          potential: nullable(input.potential),
          collectionSchedule: nullable(input.collection_schedule),
          invoiceExchangeSchedule: nullable(input.invoice_exchange_schedule),
          paymentMethodPreference: nullable(input.payment_method_preference),
          paymentToleranceDays:
            input.payment_tolerance_days == null ? null : Number(input.payment_tolerance_days),
          legalDocuments: this.customerLegalDocuments(input.legal_documents),
          responsiblePerson: jsonOrNull(input.responsible_person),
          responsibleLicense: jsonOrNull(input.responsible_license),
          nooDocument: jsonOrNull(input.noo_document),
          createdById: actorId,
          updatedById: actorId,
        },
        include: { channel: true, rayon: true },
      }),
    );
  }

  async updateCustomer(
    companyId: string,
    actorId: string,
    id: string,
    expectedVersion: number,
    input: Record<string, unknown>,
  ) {
    await this.validateCustomerEvidence(companyId, input);
    const name = String(input.name).trim();
    const channelId = nullable(input.channel_id);
    const rayonId = nullable(input.rayon_id);
    const [channel, rayon] = await Promise.all([
      channelId
        ? prisma.customerChannel.findFirst({ where: { id: channelId, companyId, state: "ACTIVE" } })
        : null,
      rayonId
        ? prisma.rayon.findFirst({ where: { id: rayonId, companyId, state: "ACTIVE" } })
        : null,
    ]);
    if (channelId && !channel) throw new NotFoundException("Channel pelanggan tidak ditemukan.");
    if (rayonId && !rayon) throw new NotFoundException("Rayon pelanggan tidak ditemukan.");
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.customer.findFirst({
        where: { id, companyId, version: expectedVersion },
      });
      if (!current)
        throw new PreconditionFailedException("Data pelanggan berubah atau tidak ditemukan.");
      if (input.relationship_stage === "TRANSACTED" && current.relationshipStage !== "TRANSACTED")
        throw new ConflictException(
          "Status pelanggan bertransaksi ditetapkan oleh Finance setelah invoice diposting.",
        );
      const updated = await tx.customer.update({
        where: { id, companyId, version: expectedVersion },
        data: {
          name,
          normalizedName: normalize(name),
          legalName: nullable(input.legal_name),
          channelId,
          rayonId,
          relationshipStage: String(input.relationship_stage ?? current.relationshipStage) as never,
          primaryAddress: nullable(input.primary_address),
          shippingAddress: nullable(input.shipping_address),
          phone: nullable(input.phone),
          email: nullable(input.email),
          taxIdentity: nullable(input.tax_identity),
          taxStatus: nullable(input.tax_status),
          billingAddress: nullable(input.billing_address),
          customerType: nullable(input.customer_type),
          potential: nullable(input.potential),
          collectionSchedule: nullable(input.collection_schedule),
          invoiceExchangeSchedule: nullable(input.invoice_exchange_schedule),
          paymentMethodPreference: nullable(input.payment_method_preference),
          paymentToleranceDays:
            input.payment_tolerance_days == null ? null : Number(input.payment_tolerance_days),
          legalDocuments: this.customerLegalDocuments(
            input.legal_documents,
            current.legalDocuments,
          ),
          responsiblePerson: jsonOrNull(input.responsible_person),
          responsibleLicense: jsonOrNull(input.responsible_license),
          nooDocument: jsonOrNull(input.noo_document),
          version: { increment: 1 },
          updatedById: actorId,
        },
        include: { channel: true, rayon: true },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "master.customer.updated",
        resourceType: "customer",
        resourceId: id,
        before: current,
        after: updated,
        metadata: { expected_version: expectedVersion },
      });
      return updated;
    });
    return result;
  }

  async createSupplier(companyId: string, actorId: string, input: Record<string, unknown>) {
    const name = String(input.name).trim();
    const code = await this.nextCode(companyId, entityTypes.supplier, actorId);
    return this.createWithAudit("supplier", companyId, actorId, async (tx) =>
      tx.supplier.create({
        data: {
          companyId,
          code,
          name,
          normalizedName: normalize(name),
          categories: (input.categories ?? []) as Prisma.InputJsonValue,
          primaryAddress: nullable(input.primary_address),
          phone: nullable(input.phone),
          salesContact: jsonOrNull(input.sales_contact),
          financeContact: jsonOrNull(input.finance_contact),
          shippingContact: jsonOrNull(input.shipping_contact),
          taxIdentity: nullable(input.tax_identity),
          technicalResponsibleName: nullable(input.technical_responsible_name),
          agreementNumber: nullable(input.agreement_number),
          legalDocuments: jsonOrNull(input.legal_documents),
          technicalResponsibleLicense: jsonOrNull(input.technical_responsible_license),
          agreementDetails: jsonOrNull(input.agreement_details),
          createdById: actorId,
          updatedById: actorId,
        },
      }),
    );
  }

  async updateSupplier(
    companyId: string,
    actorId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const expectedVersion = Number(input.version);
    return prisma.$transaction(async (tx) => {
      const current = await tx.supplier.findFirst({
        where: { id, companyId, version: expectedVersion },
      });
      if (!current)
        throw new PreconditionFailedException("Data supplier berubah atau tidak ditemukan.");
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          name: String(input.name).trim(),
          normalizedName: normalize(String(input.name)),
          categories: (input.categories ?? []) as Prisma.InputJsonValue,
          primaryAddress: nullable(input.primary_address),
          phone: nullable(input.phone),
          salesContact: jsonOrNull(input.sales_contact),
          financeContact: jsonOrNull(input.finance_contact),
          shippingContact: jsonOrNull(input.shipping_contact),
          taxIdentity: nullable(input.tax_identity),
          technicalResponsibleName: nullable(input.technical_responsible_name),
          agreementNumber: nullable(input.agreement_number),
          legalDocuments: jsonOrNull(input.legal_documents),
          technicalResponsibleLicense: jsonOrNull(input.technical_responsible_license),
          agreementDetails: jsonOrNull(input.agreement_details),
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "master.supplier.updated",
        resourceType: "supplier",
        resourceId: id,
        before: current,
        after: updated,
        metadata: { expected_version: expectedVersion },
      });
      return updated;
    });
  }

  async createVendor(companyId: string, actorId: string, input: Record<string, unknown>) {
    const name = String(input.name).trim();
    const code = await this.nextCode(companyId, entityTypes.vendor, actorId);
    return this.createWithAudit("vendor", companyId, actorId, async (tx) =>
      tx.vendor.create({
        data: {
          companyId,
          code,
          name,
          normalizedName: normalize(name),
          vendorType: String(input.vendor_type) as never,
          categories: (input.categories ?? []) as Prisma.InputJsonValue,
          primaryAddress: nullable(input.primary_address),
          phone: nullable(input.phone),
          email: nullable(input.email),
          orderContact: jsonOrNull(input.order_contact),
          financeContact: jsonOrNull(input.finance_contact),
          serviceContact: jsonOrNull(input.service_contact),
          taxIdentity: nullable(input.tax_identity),
          taxStatus: nullable(input.tax_status),
          agreementNumber: nullable(input.agreement_number),
          createdById: actorId,
          updatedById: actorId,
        },
      }),
    );
  }

  async createWarehouse(companyId: string, actorId: string, input: Record<string, unknown>) {
    const name = String(input.name).trim();
    const code = await this.nextCode(companyId, entityTypes.warehouse, actorId);
    return this.createWithAudit("warehouse", companyId, actorId, async (tx) =>
      tx.warehouse.create({
        data: {
          companyId,
          code,
          name,
          normalizedName: normalize(name),
          address: nullable(input.address),
          timezone: String(input.timezone ?? "Asia/Makassar"),
          createdById: actorId,
          updatedById: actorId,
        },
      }),
    );
  }

  async createLocator(companyId: string, actorId: string, input: Record<string, unknown>) {
    const warehouseId = String(input.warehouse_id);
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId, state: "ACTIVE" },
    });
    if (!warehouse) throw new NotFoundException("Gudang aktif tidak ditemukan.");
    const name = String(input.name).trim();
    const code = await this.nextCode(companyId, entityTypes.locator, actorId);
    return this.createWithAudit("locator", companyId, actorId, async (tx) =>
      tx.locator.create({
        data: {
          companyId,
          warehouseId,
          code,
          name,
          normalizedName: normalize(name),
          locatorType: String(input.locator_type) as never,
          pickSequence: input.pick_sequence == null ? null : Number(input.pick_sequence),
          createdById: actorId,
          updatedById: actorId,
        },
        include: { warehouse: true },
      }),
    );
  }

  async createOperationalItem(companyId: string, actorId: string, input: Record<string, unknown>) {
    const name = String(input.name).trim();
    const code = await this.nextCode(companyId, entityTypes.operational_item, actorId);
    const uom = await prisma.uom.findFirst({
      where: { id: String(input.base_uom_id), companyId, state: "ACTIVE" },
    });
    if (!uom) throw new NotFoundException("Satuan dasar tidak ditemukan.");
    return this.createWithAudit("operational_item", companyId, actorId, async (tx) =>
      tx.operationalItem.create({
        data: {
          companyId,
          code,
          name,
          normalizedName: normalize(name),
          kind: String(input.kind) as never,
          category: String(input.category),
          specification: nullable(input.specification),
          baseUomId: uom.id,
          referencePurchasePrice: decimalOrNull(input.reference_purchase_price),
          currency: nullable(input.currency),
          minimumStock: decimalOrNull(input.minimum_stock),
          stockControlled: Boolean(input.stock_controlled),
          createdById: actorId,
          updatedById: actorId,
        },
        include: { baseUom: true },
      }),
    );
  }

  async addProductUom(
    companyId: string,
    actorId: string,
    productId: string,
    input: { uom_id: string; factor_to_base: string; effective_from?: string | undefined },
  ) {
    const [product, uom] = await Promise.all([
      prisma.product.findFirst({ where: { id: productId, companyId } }),
      prisma.uom.findFirst({ where: { id: input.uom_id, companyId, state: "ACTIVE" } }),
    ]);
    if (!product || !uom) throw new NotFoundException("Produk atau satuan tidak ditemukan.");
    const factor = new Prisma.Decimal(input.factor_to_base);
    if (factor.lte(0)) throw new ConflictException("Faktor konversi harus lebih besar dari nol.");
    if (product.baseUomId === uom.id && !factor.eq(1))
      throw new ConflictException("BASE_UOM_FACTOR_MUST_BE_ONE");
    const from = input.effective_from ? new Date(input.effective_from) : new Date();
    const overlap = await prisma.productUom.count({
      where: {
        productId,
        uomId: uom.id,
        active: true,
        effectiveFrom: { lt: new Date("2999-12-31") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }],
      },
    });
    if (overlap) throw new ConflictException("PRODUCT_UOM_EFFECTIVE_OVERLAP");
    return this.createWithAudit("product_uom", companyId, actorId, async (tx) =>
      tx.productUom.create({
        data: {
          companyId,
          productId,
          uomId: uom.id,
          factorToBase: factor,
          effectiveFrom: from,
          createdById: actorId,
        },
        include: { uom: true },
      }),
    );
  }

  async changeState(
    companyId: string,
    actorId: string,
    resource: string,
    id: string,
    expectedVersion: number,
    state: MasterState,
    reason?: string,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const where = { id, companyId, version: expectedVersion };
      let before: unknown = null;
      let updated: { id: string; state: MasterState; version: number } | null = null;
      if (resource === "products") {
        const current = await tx.product.findFirst({ where, include: { registrations: true } });
        if (!current)
          throw new PreconditionFailedException("Data sudah berubah atau tidak ditemukan.");
        if (state === "ACTIVE") {
          const validRegistration = current.registrations.some(
            (item) => item.status === "VALID" && (!item.expiresOn || item.expiresOn >= new Date()),
          );
          if (!validRegistration)
            throw new ConflictException("Produk belum memiliki izin edar yang valid.");
          const storage = current.storageProfile;
          if (
            !current.storageNotes?.trim() ||
            !storage ||
            typeof storage !== "object" ||
            Array.isArray(storage)
          )
            throw new ConflictException("PRODUK_STORAGE_PROFILE_REQUIRED");
          if (current.expiryRequired && (!current.shelfLifeDays || current.shelfLifeDays < 1))
            throw new ConflictException("PRODUK_SHELF_LIFE_REQUIRED");
        }
        before = current;
        updated = await tx.product.update({
          where: { id },
          data: { state, version: { increment: 1 }, updatedById: actorId },
        });
      } else {
        const model = modelFor(resource);
        const delegate = (
          tx as unknown as Record<
            string,
            {
              findFirst: (
                args: unknown,
              ) => Promise<{ state: MasterState; version: number; id: string } | null>;
              update: (
                args: unknown,
              ) => Promise<{ state: MasterState; version: number; id: string }>;
            }
          >
        )[model];
        if (!delegate) throw new NotFoundException("Jenis master tidak tersedia.");
        const current = await delegate.findFirst({ where });
        if (!current)
          throw new PreconditionFailedException("Data sudah berubah atau tidak ditemukan.");
        before = current;
        updated = await delegate.update({
          where: { id },
          data: { state, version: { increment: 1 }, updatedById: actorId },
        });
      }
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: `master.${resource}.${state.toLowerCase()}`,
        resourceType: resource,
        resourceId: id,
        before,
        after: updated,
        ...(reason ? { reason } : {}),
      });
      return updated;
    });
    return result;
  }

  async productHistory(companyId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Produk tidak ditemukan.");
    return prisma.auditEvent.findMany({
      where: {
        companyId,
        resourceType: {
          in: ["product", "products", "product_registration", "product_reference_price"],
        },
        resourceId: id,
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
  }

  async productDuplicateCheck(companyId: string, input: Record<string, unknown>) {
    const name = String(input.name ?? "").trim();
    const code = String(input.code ?? "").trim();
    return prisma.product.findMany({
      where: { companyId, OR: [{ normalizedName: normalize(name) }, ...(code ? [{ code }] : [])] },
      select: {
        id: true,
        code: true,
        name: true,
        state: true,
        category: { select: { id: true, name: true } },
      },
      take: 20,
    });
  }

  private async createWithAudit<T>(
    resource: string,
    companyId: string,
    actorId: string,
    create: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const created = await create(tx);
        const record = created as { id: string; code?: string; name?: string; state?: string };
        await this.audit.recordWith(tx, {
          companyId,
          actorId,
          action: `master.${resource}.created`,
          resourceType: resource,
          resourceId: record.id,
          after: { code: record.code, name: record.name, state: record.state },
        });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException("Kode atau nama data sudah digunakan.");
      throw error;
    }
  }

  private async nextCode(companyId: string, entityType: keyof typeof entityTypes, actorId: string) {
    const policies = await prisma.systemPolicy.findMany({
      where: { companyId, ownerDomain: "master", policyGroup: "warehouse" },
      include: {
        versions: { where: { state: "ACTIVE" }, orderBy: { versionNo: "desc" }, take: 1 },
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
    const prefix = data?.[entityType] ?? entityType.toUpperCase();
    const length = Number(data?.sequence_length ?? 6);
    if (typeof prefix !== "string" || !Number.isInteger(length) || length < 1 || length > 12)
      throw new ConflictException(
        "Policy kode master belum lengkap. Perbaiki melalui Setting → Kebijakan Operasional.",
      );
    return prisma.$transaction(async (tx) => {
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
      void actorId;
      return `${prefix}-${sequence.nextValue.toString().padStart(length, "0")}`;
    });
  }
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
}

function nullable(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return String(value).trim();
}

function decimalOrNull(value: unknown) {
  const normalized = nullable(value);
  return normalized ? new Prisma.Decimal(normalized) : null;
}

function jsonOrNull(value: unknown) {
  return value && typeof value === "object" ? (value as Prisma.InputJsonValue) : Prisma.JsonNull;
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function modelFor(resource: string) {
  const map: Record<string, string> = {
    "product-categories": "productCategory",
    uoms: "uom",
    "customer-channels": "customerChannel",
    rayons: "rayon",
    customers: "customer",
    suppliers: "supplier",
    vendors: "vendor",
    warehouses: "warehouse",
    locators: "locator",
    "operational-items": "operationalItem",
  };
  const model = map[resource];
  if (!model) throw new NotFoundException("Jenis master tidak tersedia.");
  return model;
}
