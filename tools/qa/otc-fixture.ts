/** Isolated fictional local UAT data. Never changes an existing account or company. */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../../packages/database/src";
import { hashPassword } from "../../packages/backend/src/identity/password";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { OperationsService } from "../../packages/backend/src/sales/operations.service";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { setCustomerCredit } from "../../packages/backend/src/sales/customer-credit";
import { ensureTestTermList } from "./payment-terms-fixture";
import sharp from "../../packages/backend/node_modules/sharp";
import { financeFixture } from "../../tests/integration/finance-fixture";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Local UAT only");
  const c = randomUUID(),
    a = randomUUID(),
    password = randomUUID() + "Test!",
    email = `otc-${a.slice(0, 8)}@test.local`;
  await prisma.company.create({
    data: { id: c, name: "OTC UAT — DATA FIKTIF", timezone: "Asia/Makassar" },
  });
  await prisma.user.create({
    data: {
      id: a,
      email,
      displayName: "Operator UAT Fiktif",
      passwordHash: await hashPassword(password),
    },
  });
  const membership = await prisma.companyMembership.create({ data: { companyId: c, userId: a } });
  const bank = await financeFixture(c, a);
  const role = await prisma.role.create({
    data: { companyId: c, code: "OTC_UAT", name: "OTC UAT only" },
  });
  await prisma.userRole.create({
    data: { companyId: c, membershipId: membership.id, roleId: role.id },
  });
  const permissions = await prisma.permission.findMany({
    where: {
      OR: [
        { code: { startsWith: "sales_order." } },
        { code: { startsWith: "fulfillment." } },
        { code: { startsWith: "delivery_receipt." } },
        { code: { startsWith: "sales_invoice." } },
        { code: { startsWith: "customer_receipt." } },
        { code: { startsWith: "tax_component." } },
        { code: { startsWith: "tax_rule." } },
        { code: { startsWith: "posting_profile." } },
        { code: { startsWith: "account_mapping." } },
        { code: { startsWith: "journal." } },
        { code: { startsWith: "bank_statement." } },
        { code: { startsWith: "bank_reconciliation." } },
        { code: { startsWith: "price_request." } },
        {
          code: {
            in: [
              "audit_event.read",
              "customer.payment_policy.manage",
              "customer_credit.update",
              "sales_tax_rule.manage",
              "transaction_approval.manage",
              "inventory.quality.decide",
            ],
          },
        },
      ],
    },
  });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({
      companyId: c,
      roleId: role.id,
      permissionId: p.id,
      scopeType: "company",
      scopeId: c,
    })),
  });
  const master = (name: string) => ({
    companyId: c,
    code: randomUUID(),
    name,
    normalizedName: name.toLowerCase(),
    state: "ACTIVE" as const,
    createdById: a,
    updatedById: a,
  });
  const uom = await prisma.uom.create({ data: master("Unit uji") });
  const category = await prisma.productCategory.create({ data: master("Kategori uji") });
  const product = await prisma.product.create({
    data: { ...master("Produk UAT Fiktif"), categoryId: category.id, baseUomId: uom.id },
  });
  const channel = await prisma.customerChannel.create({ data: master("Channel uji") });
  const customer = await prisma.customer.create({
    data: { ...master("Pelanggan UAT Fiktif"), channelId: channel.id },
  });
  const warehouse = await prisma.warehouse.create({
    data: { ...master("Gudang UAT"), timezone: "Asia/Makassar" },
  });
  const locator = await prisma.locator.create({
    data: { ...master("Rak UAT"), warehouseId: warehouse.id, locatorType: "STORAGE" },
  });
  await prisma.systemPolicy.create({
    data: {
      companyId: c,
      code: "OPS-WH-02",
      name: "UAT",
      ownerDomain: "warehouse",
      policyGroup: "warehouse",
      scope: "company",
      valueType: "object",
      validationSchema: {},
      defaultValueSnapshot: {},
      versions: {
        create: {
          versionNo: 1,
          state: "ACTIVE",
          savedById: a,
          valueSnapshot: { with_expiry: "FEFO", without_expiry: "FIFO" },
        },
      },
    },
  });
  await prisma.productReferencePrice.create({
    data: {
      companyId: c,
      productId: product.id,
      uomId: uom.id,
      kind: "SALE",
      currency: "IDR",
      unitPrice: "10000",
      effectiveFrom: new Date("2020-01-01"),
      createdById: a,
    },
  });
  // Sales lines use the company default sales tax (fictional 10%, DPP factor 1).
  const taxAccount = await prisma.financeAccount.create({
    data: { companyId: c, code: "UAT-PPN", name: "PPN uji fiktif", category: "LIABILITY" },
  });
  const tax = await prisma.operationalTax.create({
    data: {
      companyId: c,
      name: "Pajak uji fiktif",
      kind: "PPN",
      usage: "SALES",
      effect: "ADD",
      accountId: taxAccount.id,
      percentage: "10",
      dppFactor: "1",
      decimalPlaces: 2,
      rounding: "HALF_UP",
      effectiveFrom: new Date("2020-01-01"),
      isDefaultSales: true,
    },
  });
  await prisma.operationalTaxRevision.create({
    data: {
      companyId: c,
      taxId: tax.id,
      version: tax.version,
      snapshot: JSON.parse(JSON.stringify(tax)),
      actorId: a,
    },
  });
  await prisma.stockLot.create({
    data: {
      companyId: c,
      productId: product.id,
      warehouseId: warehouse.id,
      locatorId: locator.id,
      batchNo: "UAT-ONLY",
      expiryDate: new Date("2090-01-01"),
      quantityOnHand: "100",
      unitCost: "3000",
      qualityState: "AVAILABLE",
    },
  });
  const ops = new OperationsService(new AuditService()),
    service = new OtcPtpService(new AuditService());
  await ensureTestTermList(prisma, c, a);
  await prisma.$transaction((tx) =>
    setCustomerCredit(tx, new AuditService(), c, a, customer.id, {
      default_term_code: "NET30",
      credit_limit: "10000000",
      past_due_grace_days: 0,
    }),
  );
  const proof = await sharp({
    text: { text: "BUKTI UJI FIKTIF\nTidak untuk transaksi nyata", width: 600, dpi: 96 },
  })
    .png()
    .toBuffer();
  const evidence: Record<string, string> = {};
  for (const purpose of ["SALES_ORDER", "POD", "PAYMENT"])
    evidence[purpose] = (
      await ops.upload(c, a, purpose, "bukti-uat.png", proof.toString("base64"))
    ).id;
  const so = await service.createSalesOrder(
    c,
    a,
    {
      customer_id: customer.id,
      customer_reference: "SP-UAT-ONLY",
      delivery_address: "Alamat fiktif untuk UAT",
      evidence_id: evidence.SALES_ORDER,
      currency: "IDR",
      lines: [{ product_id: product.id, quantity: "2", unit_price: "10000" }],
    },
    randomUUID(),
  );
  await mkdir("tmp/otc-uat", { recursive: true });
  await writeFile(
    "tmp/otc-uat/fixture.json",
    JSON.stringify(
      {
        company: c,
        bank: bank.id,
        actor: a,
        email,
        password,
        order: so.id,
        customer: customer.id,
        product: product.id,
        evidence,
      },
      null,
      2,
    ),
  );
  await writeFile("tmp/otc-uat/bukti-uat.png", proof);
  console.log("Isolated UAT fixture ready: tmp/otc-uat/fixture.json");
}
main().finally(() => prisma.$disconnect());
