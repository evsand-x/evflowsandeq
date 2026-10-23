/** Local, additive fixtures. Transactions go through domain commands; no access/password changes. */
import "../packages/backend/node_modules/reflect-metadata";
import { prisma, Prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { assertFictitiousCompany } from "./dev-company";
import { AuditService } from "../packages/backend/src/common/audit.service";
import { OtcPtpService } from "../packages/backend/src/otc-ptp.service";
import { OperationsService } from "../packages/backend/src/sales/operations.service";
import { AdministrationService } from "../packages/backend/src/administration/administration.service";
import {
  requestTaxRuleAction,
  postTaxRuleAction,
} from "../packages/backend/src/finance/tax-rule-lifecycle";
import { decideFinancialRequest } from "../packages/backend/src/finance/remediation";
import { CrmService } from "../packages/backend/src/crm/crm.service";
import {
  financeConfigure,
  importStatement,
  matchStatement,
  reconcileGl,
} from "../packages/backend/src/finance/controls.service";
import sharp from "../packages/backend/node_modules/sharp";

async function main() {
  assertDevelopmentSeed();
  const c = "00000000-0000-4000-8000-000000000001";
  const company = await prisma.company.findUniqueOrThrow({ where: { id: c } });
  await assertFictitiousCompany(company.id);
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
    throw new Error("ACTIVE_DEMO_MEMBERSHIP_REQUIRED");
  const audit = new AuditService(),
    service = new OtcPtpService(audit),
    ops = new OperationsService(audit),
    crm = new CrmService(audit);
  const key = (suffix: string) => `dev-e2e-v1-${suffix}`;
  const from = "2026-01-01",
    to = "2027-01-01",
    fixtureDate = "2026-10-07";
  // Accounts and posting profile come from the imported chart (db:seed:dev).
  const activeProfile = await prisma.financePostingProfile.findFirst({
    where: {
      companyId: c,
      effectiveFrom: { lte: new Date(fixtureDate) },
      effectiveTo: { gt: new Date(fixtureDate) },
    },
  });
  if (!activeProfile) throw new Error("POSTING_PROFILE_REQUIRED: run db:seed:dev first");
  const mappings = activeProfile.mappings as Record<string, string>;
  const period = await prisma.financePeriod.findFirst({
    where: {
      companyId: c,
      startsOn: { lte: new Date(fixtureDate) },
      endsOn: { gte: new Date(fixtureDate) },
    },
  });
  if (!period)
    await financeConfigure(
      c,
      a,
      "period",
      { starts_on: from, ends_on: "2026-12-31" },
      key("period"),
    );
  const bank = await financeConfigure(
    c,
    a,
    "bank",
    {
      code: "DEV-E2E-BANK",
      name: "Bank Simulasi - DATA UJI",
      bank_name: "BANK FIKTIF",
      last_four: "0000",
      currency: "IDR",
      account_id: mappings.CASH_RECEIPT,
    },
    key("bank"),
  );
  // Document numbering comes from the provisioned defaults (Setting › Penomoran Dokumen).
  const base = (code: string, name: string) => ({
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
  const uom = await prisma.uom.findUniqueOrThrow({
    where: { companyId_code: { companyId: c, code: "BOX" } },
  });
  const channel = await prisma.customerChannel.findUniqueOrThrow({
    where: { companyId_code: { companyId: c, code: "RS-SWASTA" } },
  });
  const warehouse = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: c, code: "DEV-E2E-WH" } },
    update: {},
    create: { ...base("DEV-E2E-WH", "Gudang Simulasi E2E"), timezone: "Asia/Makassar" },
  });
  const locator = await prisma.locator.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "DEV-E2E-RACK" } },
    update: {},
    create: {
      ...base("DEV-E2E-RACK", "Rak Simulasi A-01"),
      warehouseId: warehouse.id,
      locatorType: "STORAGE",
    },
  });
  const product = await prisma.product.upsert({
    where: { companyId_code: { companyId: c, code: "DEV-E2E-PRD" } },
    update: {},
    create: {
      ...base("DEV-E2E-PRD", "Kit Diagnostik Simulasi E2E"),
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
        effectiveFrom: new Date(from),
        createdById: a,
      },
    });
  const openingLot = await service.openStock(
    c,
    a,
    {
      product_id: product.id,
      warehouse_id: warehouse.id,
      locator_id: locator.id,
      batch_no: "DEV-E2E-BATCH-01",
      expiry_date: "2028-12-31",
      quantity: "100",
      unit_cost: "150000",
    },
    key("opening"),
  );
  const lotState = await prisma.stockLot.findUniqueOrThrow({ where: { id: openingLot.id } });
  if (lotState.qualityState === "PENDING")
    await ops.quality(
      c,
      a,
      openingLot.id,
      { state: "AVAILABLE", reason: "Pemeriksaan mutu barang simulasi DATA UJI FIKTIF" },
      key("release-quality"),
    );
  const proformaOpeningLot = await service.openStock(
    c,
    a,
    {
      product_id: product.id,
      warehouse_id: warehouse.id,
      locator_id: locator.id,
      batch_no: "DEV-E2E-BATCH-PROFORMA",
      expiry_date: "2028-12-31",
      quantity: "20",
      unit_cost: "150000",
    },
    key("opening-proforma"),
  );
  const proformaLotState = await prisma.stockLot.findUniqueOrThrow({
    where: { id: proformaOpeningLot.id },
  });
  if (proformaLotState.qualityState === "PENDING")
    await ops.quality(
      c,
      a,
      proformaOpeningLot.id,
      { state: "AVAILABLE", reason: "Pemeriksaan mutu stok proforma simulasi DATA UJI FIKTIF" },
      key("release-quality-proforma"),
    );
  const evidence: Record<string, string> = {};
  const proof = await sharp(
    Buffer.from(
      '<svg width="800" height="240"><rect width="800" height="240" fill="white"/><text x="30" y="90" font-size="28">DATA UJI FIKTIF - SIMULASI E2E</text><text x="30" y="140" font-size="22">Bukan dokumen transaksi nyata</text></svg>',
    ),
  )
    .png()
    .toBuffer();
  for (const purpose of ["SALES_ORDER", "POD", "PAYMENT", "TAX"]) {
    const name = `dev-e2e-${purpose}.png`;
    evidence[purpose] = (
      (await prisma.transactionEvidence.findFirst({
        where: { companyId: c, purpose, originalName: name },
      })) ?? (await ops.upload(c, a, purpose, name, proof.toString("base64")))
    ).id;
  }
  const codePolicy = await prisma.systemPolicy.findUniqueOrThrow({
    where: { companyId_code: { companyId: c, code: "OPS-WH-04" } },
    include: { versions: { where: { state: "ACTIVE" }, orderBy: { versionNo: "desc" }, take: 1 } },
  });
  const codeVersion = codePolicy.versions[0]!;
  const codeValue = codeVersion.valueSnapshot as Record<string, Prisma.InputJsonValue>;
  if (!codeValue.prospect)
    await new AdministrationService(audit).updatePolicy(c, a, "OPS-WH-04", codeVersion.versionNo, {
      value: { ...codeValue, prospect: "DEV-PRSP" },
      reason: "Melengkapi awalan prospek untuk DATA UJI FIKTIF",
    });
  const approver = await prisma.user.findUniqueOrThrow({
    where: { id: "00000000-0000-4000-8000-000000000002" },
  });
  if (approver.email !== "admin.test@evflow.local" || !approver.active)
    throw new Error("FICTITIOUS_APPROVER_REQUIRED");
  if (
    !(await prisma.transactionApprovalPolicy.findFirst({
      where: { companyId: c, documentKind: "TAX_RULE_CHANGE" },
    }))
  )
    await ops.approvalPolicy(
      c,
      a,
      {
        document_kind: "TAX_RULE_CHANGE",
        currency: "IDR",
        maximum_amount: "1",
        steps: [{ mode: "ALL", user_ids: [approver.id] }],
        effective_from: from,
        effective_to: to,
      },
      key("tax-approval-policy"),
    );
  const scenarios = [
    { code: "PAID", name: "RS Simulasi Sejahtera", qty: "10", stage: "paid" },
    { code: "PARTIAL", name: "Klinik Simulasi Sentosa", qty: "8", stage: "partial" },
    { code: "TRANSIT", name: "Laboratorium Simulasi Prima", qty: "6", stage: "transit" },
    // Before BACKORDER: the 150-unit backorder would otherwise consume the proforma lot.
    {
      code: "PROFORMA_DRAFT",
      name: "Klinik Simulasi Proforma Draft",
      qty: "10",
      stage: "allocated",
    },
    { code: "BACKORDER", name: "RS Simulasi Nusantara", qty: "150", stage: "allocated" },
    { code: "DRAFT", name: "Klinik Simulasi Harapan", qty: "5", stage: "draft" },
  ];
  const results = [];
  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    // Preserve the original DRAFT fixture payload when adding new scenarios.
    const index = scenario.code === "DRAFT" ? 4 : scenarioIndex;
    const code = `DEV-E2E-${scenario.code}`;
    const customer = await prisma.customer.upsert({
      where: { companyId_code: { companyId: c, code } },
      update: {},
      create: {
        ...base(code, scenario.name),
        channelId: channel.id,
        primaryAddress: "Alamat simulasi Makassar - DATA UJI FIKTIF",
        shippingAddress: "Alamat simulasi Makassar - DATA UJI FIKTIF",
      },
    });
    if (
      !(await prisma.customerPaymentPolicy.findFirst({
        where: { companyId: c, customerId: customer.id },
      }))
    )
      await service.setPaymentPolicy(c, a, customer.id, {
        mode: "TEMPO",
        top_days: 30,
        credit_limit: "500000000",
        past_due_grace_days: 0,
        effective_from: from,
      });
    const taxRule = await ops.tax(
      c,
      a,
      {
        customer_id: customer.id,
        product_id: product.id,
        name: "Pajak Simulasi 11%",
        legal_reference: "DATA UJI FIKTIF - bukan tarif pajak resmi",
        rate: "0.11",
        dpp_factor: "1",
        decimal_places: 2,
        rounding: "HALF_UP",
        effective_from: from,
        effective_to: "2099-01-01",
      },
      key(`tax-${scenario.code}`),
    );
    const actualTax = await prisma.salesTaxRule.findUniqueOrThrow({ where: { id: taxRule.id } });
    if (actualTax.state === "DRAFT") {
      const request = await requestTaxRuleAction(
        c,
        a,
        {
          rule_id: taxRule.id,
          rule_kind: "SALES",
          action: "ACTIVATE",
          reason: "Aktivasi aturan DATA UJI FIKTIF",
          evidence_id: evidence.TAX,
        },
        key(`tax-request-${scenario.code}`),
      );
      await decideFinancialRequest(
        c,
        approver.id,
        request.id,
        "TAX_RULE_CHANGE",
        { decision: "APPROVED", reason: "Persetujuan simulasi oleh aktor uji terpisah" },
        key(`tax-approve-${scenario.code}`),
      );
      await postTaxRuleAction(c, a, request.id, key(`tax-post-${scenario.code}`));
    }
    const contact = await crm.createContact(
      c,
      a,
      {
        customer_id: customer.id,
        full_name: `PIC Simulasi ${index + 1}`,
        job_title: "Pengadaan",
        email: `pic-${index + 1}@example.invalid`,
        notes: "DATA UJI FIKTIF",
      },
      key(`contact-${scenario.code}`),
    );
    await crm.createProspect(
      c,
      a,
      {
        customer_id: customer.id,
        owner_id: a,
        contact_ids: [contact.id],
        source: "Simulasi development",
        next_action: "Tindak lanjut kebutuhan produk - DATA UJI",
        next_action_at: `2026-10-${String(8 + index).padStart(2, "0")}T01:00:00.000Z`,
        notes: "DATA UJI FIKTIF",
        needs: [{ product_id: product.id, estimated_qty: scenario.qty, uom_id: uom.id }],
      },
      key(`prospect-${scenario.code}`),
    );
    const reference = `DEV-E2E-SP-${scenario.code}`;
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
          delivery_address: customer.shippingAddress,
          evidence_id: evidence.SALES_ORDER,
          currency: "IDR",
          notes: `DATA UJI FIKTIF - skenario ${scenario.stage}`,
          lines: [{ product_id: product.id, quantity: scenario.qty, unit_price: "250000" }],
        },
        key(`order-${scenario.code}`),
      ));
    if (scenario.stage !== "draft") {
      if (order.state === "DRAFT")
        await service.submitSalesOrder(c, a, order.id, key(`submit-${scenario.code}`));
      // Re-read: submit changes the state captured before it.
      const submitted = await prisma.salesOrder.findUniqueOrThrow({ where: { id: order.id } });
      if (
        submitted.state === "OPEN" &&
        !(await prisma.fulfillmentBatch.count({ where: { companyId: c, salesOrderId: order.id } }))
      ) {
        const currentOrder = await prisma.salesOrder.findUniqueOrThrow({ where: { id: order.id } });
        await service.submitSalesOrder(
          c,
          a,
          order.id,
          key(`reallocate-${scenario.code}`),
          currentOrder.version,
        );
      }
      const settled = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { lines: true },
      });
      if (
        !(await prisma.fulfillmentBatch.count({ where: { companyId: c, salesOrderId: order.id } }))
      )
        throw new Error(
          `ORDER_NOT_ALLOCATED:${scenario.code}:${settled.state}:${settled.lines.map((l) => `${l.allocatedQuantity}/${l.orderedQuantity}`)}`,
        );
      const batch = await prisma.fulfillmentBatch.findFirstOrThrow({
        where: { companyId: c, salesOrderId: order.id },
        include: {
          allocations: true,
          pickList: { include: { lines: true } },
          deliveryReceipts: true,
        },
      });
      if (scenario.stage !== "allocated") {
        if (batch.state === "ALLOCATED") {
          if (!batch.pickList)
            await service.createPickingSlip(c, a, batch.id, key(`pick-${scenario.code}`));
          const pick = await prisma.pickList.findFirstOrThrow({
            where: { fulfillmentBatchId: batch.id },
            include: { lines: true },
          });
          if (pick.state === "OPEN")
            await service.confirmPick(
              c,
              a,
              pick.id,
              {
                lines: pick.lines.map((l) => ({
                  pick_list_line_id: l.id,
                  picked_quantity: l.assignedQuantity.toString(),
                })),
              },
              key(`pick-${scenario.code}`),
            );
          if (pick.state !== "CHECKED")
            await service.confirmCheck(c, a, pick.id, key(`check-${scenario.code}`));
          await ops.shipment(
            c,
            a,
            batch.id,
            {
              driver: "Pengemudi Simulasi",
              vehicle: "DEV-E2E",
              planned_at: "2026-10-07T02:00:00.000Z",
            },
            key(`shipment-${scenario.code}`),
          );
          await service.dispatch(c, a, batch.id, key(`dispatch-${scenario.code}`));
        }
        if (scenario.stage !== "transit") {
          const pod =
            batch.deliveryReceipts[0] ??
            (await service.confirmPod(
              c,
              a,
              batch.id,
              {
                receiver_name: "Penerima Simulasi",
                evidence_id: evidence.POD,
                lines: batch.allocations.map((l) => ({
                  fulfillment_allocation_id: l.id,
                  accepted_quantity: l.quantity.toString(),
                })),
              },
              key(`pod-${scenario.code}`),
            ));
          const invoice = await service.postInvoice(c, a, pod.id, key(`invoice-${scenario.code}`));
          if (!invoice.total) throw new Error("INVOICE_TOTAL_REQUIRED");
          const amount =
            scenario.stage === "paid"
              ? invoice.total.toString()
              : new Prisma.Decimal(invoice.total.toString()).div(2).toString();
          const receipt = await service.createCustomerReceipt(
            c,
            a,
            customer.id,
            {
              amount,
              currency: "IDR",
              evidence_id: evidence.PAYMENT,
              bank_reference: `DEV-E2E-MUTASI-${scenario.code}`,
              bank_account_id: bank.id,
              received_at: "2026-10-07T03:00:00.000Z",
            },
            key(`receipt-${scenario.code}`),
          );
          await service.allocateCustomerReceipt(
            c,
            a,
            receipt.id,
            { invoice_id: invoice.id, amount },
            key(`allocate-${scenario.code}`),
          );
          const statementDate = `2026-10-${String(7 + index).padStart(2, "0")}`;
          const previousStatement = await prisma.bankStatement.findFirst({
            where: {
              companyId: c,
              bankAccountId: bank.id,
              endsOn: { lt: new Date(statementDate) },
            },
            orderBy: { endsOn: "desc" },
          });
          const openingBalance = previousStatement?.closingBalance.toString() ?? "0";
          const statement = await importStatement(
            c,
            a,
            {
              bank_account_id: bank.id,
              starts_on: statementDate,
              ends_on: statementDate,
              opening_balance: openingBalance,
              closing_balance: new Prisma.Decimal(openingBalance).add(amount).toString(),
              lines: [
                {
                  external_id: `DEV-E2E-${scenario.code}`,
                  reference: `DEV-E2E-MUTASI-${scenario.code}`,
                  value_date: statementDate,
                  amount,
                  description: "DATA UJI FIKTIF - penerimaan pelanggan",
                },
              ],
            },
            key(`statement-${scenario.code}`),
          );
          const line = await prisma.bankStatementLine.findFirstOrThrow({
            where: { statementId: statement.id },
          });
          await matchStatement(c, a, line.id, receipt.id, key(`match-${scenario.code}`));
        }
      }
    }
    const current = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { lines: true },
    });
    results.push({
      scenario: scenario.stage,
      number: current.number,
      id: current.id,
      state: current.state,
      backorder: current.lines.map((l) => l.backorderQuantity.toString()),
    });
  }
  const journals = await prisma.financeJournal.findMany({
    where: { companyId: c },
    include: { lines: true },
  });
  if (
    journals.some(
      (j) =>
        !j.lines.reduce((sum, l) => sum.add(l.debit).sub(l.credit), new Prisma.Decimal(0)).isZero(),
    )
  )
    throw new Error("UNBALANCED_JOURNAL");
  const reconciliation = await reconcileGl(c);
  if (!reconciliation.balanced) throw new Error("UNBALANCED_RECONCILIATION");
  await audit.record({
    companyId: c,
    actorId: a,
    action: "development.full_seed.applied",
    resourceType: "development_seed",
    metadata: { version: "e2e-v1", order_ids: results.map((r) => r.id) },
  });
  console.log(
    JSON.stringify(
      { company: company.name, orders: results, journals: journals.length, reconciliation },
      null,
      2,
    ),
  );
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? process.env.SEED_DEBUG
          ? error.stack
          : error.message
        : "Seed failed",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
