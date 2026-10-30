/**
 * Local, idempotent O2C Release 1 demo: one submitted SO, one partially issued Surat Jalan and
 * one invoice from that Surat Jalan. Every transaction goes through domain commands with stable
 * idempotency keys; the guards refuse anything but the local fictitious development company.
 */
import "../packages/backend/node_modules/reflect-metadata";
import { prisma, Prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { assertFictitiousCompany } from "./dev-company";
import { AuditService } from "../packages/backend/src/common/audit.service";
import { OtcPtpService } from "../packages/backend/src/otc-ptp.service";
import { OperationsService } from "../packages/backend/src/sales/operations.service";
import { setCustomerCredit, paymentTerms } from "../packages/backend/src/sales/customer-credit";
import { financeConfigure } from "../packages/backend/src/finance/controls.service";
import { createDeliveryNote, issueDeliveryNote } from "../packages/backend/src/sales/delivery-note";
import sharp from "../packages/backend/node_modules/sharp";

const orderDate = "2026-10-27";
const handoverAt = "2026-10-28T02:40:00.000Z";
const ordered = "150";
const delivered = "86";

async function main() {
  assertDevelopmentSeed();
  const c = "00000000-0000-4000-8000-000000000001";
  await assertFictitiousCompany(c);
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: "demo.admin@evflow.local" },
  });
  const a = actor.id;
  if (
    !actor.active ||
    !(await prisma.companyMembership.findFirst({
      where: { companyId: c, userId: a, active: true },
    }))
  )
    throw new Error("ACTIVE_DEMO_MEMBERSHIP_REQUIRED: run the demo admin seed first");
  const audit = new AuditService(),
    service = new OtcPtpService(audit),
    ops = new OperationsService(audit);
  const key = (suffix: string) => `dev-o2c-demo-v1-${suffix}`;

  // Posting profile and the chart come from db:seed:dev; the 2026 period is opened when missing.
  if (
    !(await prisma.financePostingProfile.findFirst({
      where: {
        companyId: c,
        effectiveFrom: { lte: new Date(handoverAt) },
        effectiveTo: { gt: new Date(handoverAt) },
      },
    }))
  )
    throw new Error("POSTING_PROFILE_REQUIRED: run db:seed:dev first");
  if (
    !(await prisma.financePeriod.findFirst({
      where: {
        companyId: c,
        startsOn: { lte: new Date(orderDate) },
        endsOn: { gte: new Date(handoverAt) },
      },
    }))
  )
    await financeConfigure(
      c,
      a,
      "period",
      { starts_on: "2026-01-01", ends_on: "2026-12-31" },
      key("period"),
    );

  const base = (code: string, name: string) => ({
    companyId: c,
    code,
    name,
    normalizedName: name.toLowerCase(),
    state: "ACTIVE" as const,
    createdById: a,
    updatedById: a,
  });
  const [category, uom, channel] = await Promise.all([
    prisma.productCategory.findUniqueOrThrow({
      where: { companyId_code: { companyId: c, code: "IVD" } },
    }),
    prisma.uom.findUniqueOrThrow({ where: { companyId_code: { companyId: c, code: "BOX" } } }),
    prisma.customerChannel.findUniqueOrThrow({
      where: { companyId_code: { companyId: c, code: "RS-SWASTA" } },
    }),
  ]);
  // Reuse the company's sales warehouse so the demo does not add a second warehouse (which would
  // require a default warehouse in Setting before any new SO can be saved).
  const warehouse =
    (await prisma.warehouse.findFirst({
      where: { companyId: c, state: "ACTIVE" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) ??
    (await prisma.warehouse.create({
      data: { ...base("DEV-O2C-WH", "Gudang Makassar Simulasi"), timezone: "Asia/Makassar" },
    }));
  const locator =
    (await prisma.locator.findFirst({
      where: { companyId: c, warehouseId: warehouse.id, state: "ACTIVE", locatorType: "STORAGE" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) ??
    (await prisma.locator.create({
      data: {
        ...base("DEV-O2C-RACK", "Rak Simulasi O2C A-01"),
        warehouseId: warehouse.id,
        locatorType: "STORAGE",
      },
    }));
  const product = await prisma.product.upsert({
    where: { companyId_code: { companyId: c, code: "DEV-O2C-PRD" } },
    update: {},
    create: {
      ...base("DEV-O2C-PRD", "Kit Diagnostik Simulasi O2C"),
      categoryId: category.id,
      baseUomId: uom.id,
    },
  });
  if (
    !(await prisma.productReferencePrice.findFirst({
      where: { companyId: c, productId: product.id, kind: "SALE" },
    }))
  )
    await prisma.productReferencePrice.create({
      data: {
        companyId: c,
        productId: product.id,
        uomId: uom.id,
        kind: "SALE",
        currency: "IDR",
        unitPrice: "250000",
        effectiveFrom: new Date("2026-01-01"),
        createdById: a,
      },
    });
  const lot = await service.openStock(
    c,
    a,
    {
      product_id: product.id,
      warehouse_id: warehouse.id,
      locator_id: locator.id,
      batch_no: "DEV-O2C-LOT-01",
      expiry_date: "2028-12-31",
      quantity: "100",
      unit_cost: "150000",
    },
    key("opening"),
  );
  if (
    (await prisma.stockLot.findUniqueOrThrow({ where: { id: lot.id } })).qualityState === "PENDING"
  )
    await ops.quality(
      c,
      a,
      lot.id,
      { state: "AVAILABLE", reason: "Pemeriksaan mutu barang simulasi O2C - DATA UJI FIKTIF" },
      key("release-quality"),
    );

  const terms = await paymentTerms(prisma, c);
  const term = terms.find((t) => t.code === "NET30") ?? terms.find((t) => t.kind === "TEMPO");
  if (!term) throw new Error("PAYMENT_TERM_REQUIRED: Setting › Termin has no tempo term");
  const customer = await prisma.customer.upsert({
    where: { companyId_code: { companyId: c, code: "DEV-O2C-CUST" } },
    update: {},
    create: {
      ...base("DEV-O2C-CUST", "RS Simulasi Nusantara O2C"),
      channelId: channel.id,
      primaryAddress: "Alamat simulasi Makassar - DATA UJI FIKTIF",
      shippingAddress: "Alamat simulasi Makassar - DATA UJI FIKTIF",
    },
  });
  if (!customer.defaultTermCode)
    await prisma.$transaction((tx) =>
      setCustomerCredit(tx, audit, c, a, customer.id, {
        default_term_code: term.code,
        credit_limit: "500000000",
        past_due_grace_days: 0,
      }),
    );

  const proof = await sharp(
    Buffer.from(
      '<svg width="800" height="240"><rect width="800" height="240" fill="white"/><text x="30" y="90" font-size="28">DATA UJI FIKTIF - SIMULASI O2C</text><text x="30" y="140" font-size="22">Bukan dokumen transaksi nyata</text></svg>',
    ),
  )
    .png()
    .toBuffer();
  const evidence = async (purpose: string) => {
    const name = `dev-o2c-${purpose.toLowerCase()}.png`;
    return (
      (await prisma.transactionEvidence.findFirst({
        where: { companyId: c, purpose, originalName: name },
      })) ?? (await ops.upload(c, a, purpose, name, proof.toString("base64")))
    ).id;
  };

  const reference = "DEV-O2C-SP-001";
  const order =
    (await prisma.salesOrder.findFirst({
      where: { companyId: c, customerReference: reference },
    })) ??
    (await service.createSalesOrder(
      c,
      a,
      {
        customer_id: customer.id,
        customer_reference: reference,
        order_date: orderDate,
        payment_term_code: term.code,
        warehouse_id: warehouse.id,
        delivery_address: customer.shippingAddress ?? undefined,
        evidence_id: await evidence("SALES_ORDER"),
        currency: "IDR",
        notes: "DATA UJI FIKTIF - SO terkirim sebagian",
        lines: [{ product_id: product.id, quantity: ordered, unit_price: "250000" }],
      },
      key("order"),
    ));
  if (order.state === "DRAFT") await service.submitSalesOrder(c, a, order.id, key("submit"));
  const submitted = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: order.id },
    include: { lines: true },
  });
  if (submitted.state !== "OPEN")
    throw new Error(`ORDER_NOT_OPEN: SO ${submitted.number} is ${submitted.state}`);
  const line = submitted.lines[0]!;

  const existing = await prisma.deliveryNote.findFirst({
    where: { companyId: c, salesOrderId: order.id, state: { in: ["DRAFT", "ISSUED"] } },
    orderBy: { createdAt: "asc" },
  });
  const note =
    existing ??
    (await createDeliveryNote(
      c,
      a,
      {
        sales_order_id: order.id,
        lines: [
          {
            sales_order_line_id: line.id,
            quantity: delivered,
            warehouse_id: warehouse.id,
            locator_id: locator.id,
          },
        ],
        notes: "DATA UJI FIKTIF - pengiriman pertama",
      },
      key("delivery-note"),
    ));
  if (note.state === "DRAFT")
    await issueDeliveryNote(
      c,
      a,
      note.id,
      {
        handover_at: handoverAt,
        receiver_name: "Petugas Simulasi",
        evidence_id: await evidence("SURAT_JALAN"),
        lines: [{ sales_order_line_id: line.id, delivered_quantity: delivered }],
      },
      key("issue"),
    );
  const invoice =
    (await prisma.salesInvoice.findFirst({
      where: { companyId: c, deliveryNoteId: note.id, state: { not: "VOID" } },
    })) ??
    (await service.createInvoiceFromDeliveryNote(
      c,
      a,
      { surat_jalan_id: note.id },
      key("invoice"),
    ));
  const issued = await prisma.deliveryNote.findUniqueOrThrow({ where: { id: note.id } });
  console.log(
    JSON.stringify({
      sales_order: submitted.number,
      delivery_note: issued.number,
      invoice: invoice.number,
      ordered,
      delivered,
      remaining: new Prisma.Decimal(ordered).sub(delivered).toString(),
    }),
  );
}

main().finally(() => prisma.$disconnect());
