import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@evflow/database";

describe("master data persistence", () => {
  const companyId = randomUUID();
  const otherCompanyId = randomUUID();
  const userId = randomUUID();
  const otherUserId = randomUUID();
  let categoryId: string;
  let uomId: string;
  let productId: string;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.company.createMany({
      data: [
        { id: companyId, name: "Master Data Uji Fiktif" },
        { id: otherCompanyId, name: "Master Data Scope Lain Uji Fiktif" },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: userId,
          email: `master-${userId}@evflow.local`,
          displayName: "Uji Master",
          passwordHash: "TEST_ACCOUNT_DISABLED_PASSWORD_HASH",
        },
        {
          id: otherUserId,
          email: `master-${otherUserId}@evflow.local`,
          displayName: "Uji Scope Lain",
          passwordHash: "TEST_ACCOUNT_DISABLED_PASSWORD_HASH",
        },
      ],
    });
    const [category, uom] = await prisma.$transaction([
      prisma.productCategory.create({
        data: {
          companyId,
          code: "ALKES",
          name: "Alat Kesehatan",
          normalizedName: "alat kesehatan",
          createdById: userId,
          updatedById: userId,
        },
      }),
      prisma.uom.create({
        data: {
          companyId,
          code: "PCS",
          name: "Pcs",
          normalizedName: "pcs",
          createdById: userId,
          updatedById: userId,
        },
      }),
    ]);
    categoryId = category.id;
    uomId = uom.id;
  });

  afterAll(async () => {
    await prisma.productUom.deleteMany({ where: { companyId } });
    await prisma.productReferencePrice.deleteMany({ where: { companyId } });
    await prisma.productRegistration.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.productCategory.deleteMany({ where: { companyId } });
    await prisma.uom.deleteMany({ where: { companyId } });
    await prisma.auditEvent.deleteMany({
      where: { companyId: { in: [companyId, otherCompanyId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    await prisma.$disconnect();
  });

  it("keeps money and conversion factors as PostgreSQL decimals", async () => {
    const product = await prisma.product.create({
      data: {
        companyId,
        code: "PRD-000001",
        name: "Produk Uji Decimal",
        normalizedName: "produk uji decimal",
        categoryId,
        baseUomId: uomId,
        createdById: userId,
        updatedById: userId,
        uoms: {
          create: { companyId, uomId, factorToBase: new Prisma.Decimal("1"), createdById: userId },
        },
        referencePrices: {
          create: {
            companyId,
            uomId,
            kind: "SALE",
            currency: "IDR",
            unitPrice: new Prisma.Decimal("12500.7500"),
            effectiveFrom: new Date(),
            createdById: userId,
          },
        },
      },
    });
    productId = product.id;
    const price = await prisma.productReferencePrice.findFirstOrThrow({ where: { productId } });
    const conversion = await prisma.productUom.create({
      data: {
        companyId,
        productId,
        uomId,
        factorToBase: new Prisma.Decimal("1.2500000000"),
        createdById: userId,
      },
    });
    expect(price.unitPrice.toString()).toBe("12500.75");
    expect(conversion.factorToBase.toString()).toBe("1.25");
  });

  it("blocks duplicate names within one company while keeping company scope isolated", async () => {
    await expect(
      prisma.productCategory.create({
        data: {
          companyId,
          code: "ALKES-2",
          name: "Alat Kesehatan",
          normalizedName: "alat kesehatan",
          createdById: userId,
          updatedById: userId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    const otherCompanyCategories = await prisma.productCategory.findMany({
      where: { companyId: otherCompanyId },
    });
    expect(otherCompanyCategories).toHaveLength(0);
  });
});
