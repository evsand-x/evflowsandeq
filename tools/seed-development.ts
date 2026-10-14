import "../packages/backend/node_modules/reflect-metadata";
import { prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { AuditService } from "../packages/backend/src/common/audit.service";
import { AccessService } from "../packages/backend/src/identity/access.service";
import { OtcPtpService } from "../packages/backend/src/otc-ptp.service";
import { OperationsService } from "../packages/backend/src/sales/operations.service";
import { configureNumbering } from "../packages/backend/src/common/document-number";
import sharp from "../packages/backend/node_modules/sharp";

async function main() {
  assertDevelopmentSeed();
  const c = "00000000-0000-4000-8000-000000000001";
  const company = await prisma.company.findUniqueOrThrow({ where: { id: c } });
  if (!company.name.includes("DATA UJI FIKTIF")) throw new Error("FICTITIOUS_COMPANY_REQUIRED");
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo.admin@evflow.local" } });
  const a = user.id;
  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { companyId_userId: { companyId: c, userId: a } },
    include: { userRoles: true },
  });
  if (!user.active || !membership.active) throw new Error("ACTIVE_DEMO_ACCOUNT_REQUIRED");
  const audit = new AuditService(),
    access = new AccessService(audit),
    service = new OtcPtpService(audit),
    ops = new OperationsService(audit);
  // An isolated role avoids expanding the shared production-style ADMIN_SYSTEM role.
  const codes = [
    "sales_order.read",
    "sales_order.create",
    "sales_order.update",
    "sales_order.submit",
    "audit_event.read",
  ];
  const permissions = await prisma.permission.findMany({ where: { code: { in: codes } } });
  if (permissions.length !== codes.length)
    throw new Error("Run database migrations first: SO permissions missing");
  let role = await prisma.role.findUnique({
    where: { companyId_code: { companyId: c, code: "DEV_SALES_ORDER" } },
  });
  if (!role) {
    await access.createRole(c, a, {
      code: "DEV_SALES_ORDER",
      name: "Sales Order — DATA UJI DEV",
      description: "Local fictitious development only",
    });
    role = await prisma.role.findUniqueOrThrow({
      where: { companyId_code: { companyId: c, code: "DEV_SALES_ORDER" } },
    });
  }
  const grants = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
  if (
    permissions.some(
      (p) => !grants.some((g) => g.permissionId === p.id && g.scopeType === "company"),
    )
  )
    await access.updateRolePermissions(c, a, role.id, [
      ...grants.map((g) => ({
        permission_id: g.permissionId,
        scope_type: g.scopeType,
        scope_id: g.scopeId,
      })),
      ...permissions
        .filter((p) => !grants.some((g) => g.permissionId === p.id && g.scopeType === "company"))
        .map((p) => ({ permission_id: p.id, scope_type: "company", scope_id: c })),
    ]);
  if (!membership.userRoles.some((r) => r.roleId === role.id))
    await access.assignRoles(c, a, a, [...membership.userRoles.map((r) => r.roleId), role.id]);
  const master = (code: string, name: string) => ({
    companyId: c,
    code,
    name,
    normalizedName: name.toLowerCase(),
    state: "ACTIVE" as const,
    createdById: a,
    updatedById: a,
  });
  const category = await prisma.productCategory.findUniqueOrThrow({
    where: { companyId_code: { companyId: c, code: "IVD" } },
  });
  const box = await prisma.uom.findUniqueOrThrow({
    where: { companyId_code: { companyId: c, code: "BOX" } },
  });
  const kit = await prisma.uom.upsert({
    where: { companyId_code: { companyId: c, code: "DEV-KIT" } },
    update: {},
    create: master("DEV-KIT", "Kit"),
  });
  const channel = await prisma.customerChannel.findUniqueOrThrow({
    where: { companyId_code: { companyId: c, code: "RS-SWASTA" } },
  });
  const specs = [
    ["0101", "Reagen kimia klinik", "2500000", kit.id],
    ["0152", "Kalibrator hematologi", "1000000", kit.id],
    ["0153", "Kontrol hematologi", "1200000", kit.id],
    ["0201", "Tabung EDTA 3 ml", "310000", box.id],
    ["0202", "Sarung tangan nitril", "85000", box.id],
  ] as const;
  const products: { id: string; code: string }[] = [];
  for (const [code, name, price, uom] of specs) {
    const product = await prisma.product.upsert({
      where: { companyId_code: { companyId: c, code: `DEV-PRD-${code}` } },
      update: {},
      create: { ...master(`DEV-PRD-${code}`, name), categoryId: category.id, baseUomId: uom },
    });
    products.push(product);
    if (
      !(await prisma.productReferencePrice.findFirst({
        where: { companyId: c, productId: product.id, kind: "SALE" },
      }))
    )
      await prisma.productReferencePrice.create({
        data: {
          companyId: c,
          productId: product.id,
          uomId: uom,
          kind: "SALE",
          currency: "IDR",
          unitPrice: price,
          effectiveFrom: new Date("2026-01-01"),
          createdById: a,
        },
      });
  }
  if (
    !(await prisma.documentNumberRule.findFirst({
      where: { companyId: c, documentKind: "sales_order" },
    }))
  )
    await configureNumbering(
      c,
      a,
      {
        document_kind: "sales_order",
        prefix: "DEV-SO-",
        digits: 6,
        reset_yearly: true,
        effective_from: "2026-01-01",
        effective_to: "2099-01-01",
      },
      "dev-seed-v1-numbering-so",
    );
  let evidence = await prisma.transactionEvidence.findFirst({
    where: { companyId: c, purpose: "SALES_ORDER", originalName: "dev-seed-v1-sp.png" },
  });
  if (!evidence) {
    const svg = Buffer.from(
      '<svg width="800" height="240"><rect width="800" height="240" fill="white"/><text x="30" y="80" font-size="30">SP CONTOH DEV - DATA UJI FIKTIF</text><text x="30" y="140" font-size="22">Bukan pesanan pelanggan nyata</text></svg>',
    );
    const bytes = await sharp(svg).png().toBuffer();
    const uploaded = await ops.upload(
      c,
      a,
      "SALES_ORDER",
      "dev-seed-v1-sp.png",
      bytes.toString("base64"),
    );
    evidence = await prisma.transactionEvidence.findUniqueOrThrow({ where: { id: uploaded.id } });
  }
  const names = ["RS Harapan Medika", "RS Bina Sehat", "Klinik Mitra Utama", "RS Citra Medika"];
  const orders = [];
  for (const [index, name] of names.entries()) {
    const code = `DEV-CUS-${index + 1}`;
    const customer = await prisma.customer.upsert({
      where: { companyId_code: { companyId: c, code } },
      update: {},
      create: {
        ...master(code, name),
        channelId: channel.id,
        primaryAddress: "Alamat contoh Makassar — DATA UJI FIKTIF",
        shippingAddress: "Alamat contoh Makassar — DATA UJI FIKTIF",
      },
    });
    if (
      !(await prisma.customerPaymentPolicy.findFirst({
        where: { companyId: c, customerId: customer.id },
      }))
    )
      await service.setPaymentPolicy(c, a, customer.id, {
        mode: "COD",
        top_days: 0,
        effective_from: "2026-01-01",
      });
    for (const product of products) {
      if (
        !(await prisma.salesTaxRule.findFirst({
          where: { companyId: c, customerId: customer.id, productId: product.id },
        }))
      )
        await ops.tax(
          c,
          a,
          {
            customer_id: customer.id,
            product_id: product.id,
            name: "PPN CONTOH DEV 11%",
            legal_reference: "DATA UJI FIKTIF - bukan ketentuan pajak resmi",
            rate: "0.11",
            dpp_factor: "1",
            decimal_places: 2,
            rounding: "HALF_UP",
            effective_from: "2026-01-01",
            effective_to: "2099-01-01",
          },
          `dev-seed-tax-${code}-${product.code}`,
        );
    }
    const reference = `DEV-SP-${index + 1}`;
    let order = await prisma.salesOrder.findFirst({
      where: { companyId: c, customerReference: reference },
    });
    if (!order) {
      const selected =
        index === 3
          ? ([
              [3, "20"],
              [4, "30"],
            ] as const)
          : ([
              [0, "10"],
              [1, "5"],
              [2, "2"],
            ] as const);
      order = await service.createSalesOrder(
        c,
        a,
        {
          customer_id: customer.id,
          customer_reference: reference,
          delivery_address: customer.shippingAddress,
          evidence_id: evidence.id,
          currency: "IDR",
          notes: "DATA UJI FIKTIF — seed dev, dapat diproses melalui aplikasi operasional.",
          lines: selected.map(([i, qty]) => ({
            product_id: products[i]!.id,
            quantity: qty,
            unit_price: specs[i]![2],
          })),
        },
        `dev-seed-v1-so-${index}`,
      );
    }
    orders.push({ id: order!.id, number: order!.number, state: order!.state });
  }
  await audit.record({
    companyId: c,
    actorId: a,
    action: "development.operational_seed.applied",
    resourceType: "development_seed",
    metadata: {
      version: 1,
      customer_count: names.length,
      product_count: products.length,
      order_ids: orders.map((o) => o.id),
    },
  });
  console.log(JSON.stringify({ email: user.email, company: company.name, orders }, null, 2));
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
