import { randomUUID } from "node:crypto";
import { CrmService } from "@evflow/backend";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { prisma } from "@evflow/database";
import { crmPage, crmDetail, crmSummary } from "../../packages/backend/src/crm/crm-workspace";

describe("CRM contacts and prospects", () => {
  const companyId = randomUUID();
  const userId = randomUUID();
  let customerId: string;
  let contactId: string;
  let productId: string;
  let uomId: string;
  const service = new CrmService(new AuditService());

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.company.create({ data: { id: companyId, name: "CRM Data Uji Fiktif" } });
    await prisma.user.create({
      data: {
        id: userId,
        email: `crm-${userId}@evflow.local`,
        displayName: "CRM Tester",
        passwordHash: "TEST_ACCOUNT_DISABLED_PASSWORD_HASH",
      },
    });
    await prisma.companyMembership.create({ data: { companyId, userId } });
    await prisma.systemPolicy.create({
      data: {
        companyId,
        code: "OPS-WH-04",
        name: "Test numbering",
        ownerDomain: "master",
        policyGroup: "warehouse",
        scope: "company",
        valueType: "object",
        validationSchema: {},
        defaultValueSnapshot: {},
        versions: {
          create: {
            versionNo: 1,
            state: "ACTIVE",
            valueSnapshot: {
              sequence_length: 6,
              contact: "CTC",
              prospect: "PRSP",
              opportunity: "OPP",
              customer: "CUS",
            },
            savedById: userId,
          },
        },
      },
    });
    const category = await prisma.productCategory.create({
      data: {
        companyId,
        code: "CRM-CAT",
        name: "Kategori CRM",
        normalizedName: "kategori crm",
        createdById: userId,
        updatedById: userId,
      },
    });
    const uom = await prisma.uom.create({
      data: {
        companyId,
        code: "CRM-PCS",
        name: "Pcs CRM",
        normalizedName: "pcs crm",
        createdById: userId,
        updatedById: userId,
      },
    });
    uomId = uom.id;
    const product = await prisma.product.create({
      data: {
        companyId,
        code: "CRM-PRD",
        name: "Produk CRM",
        normalizedName: "produk crm",
        categoryId: category.id,
        baseUomId: uom.id,
        createdById: userId,
        updatedById: userId,
      },
    });
    productId = product.id;
    const customer = await prisma.customer.create({
      data: {
        companyId,
        code: "CRM-CUST",
        name: "Pelanggan CRM",
        normalizedName: "pelanggan crm",
        createdById: userId,
        updatedById: userId,
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.opportunityOutcomeLine.deleteMany({ where: { companyId } });
    await prisma.opportunityOutcome.deleteMany({ where: { companyId } });
    await prisma.customerOrder.deleteMany({ where: { companyId } });
    await prisma.opportunityLine.deleteMany({ where: { companyId } });
    await prisma.opportunity.deleteMany({ where: { companyId } });
    await prisma.prospectNeed.deleteMany({ where: { companyId } });
    await prisma.prospect.deleteMany({ where: { companyId } });
    await prisma.contact.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
    await prisma.customerChannel.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.productCategory.deleteMany({ where: { companyId } });
    await prisma.uom.deleteMany({ where: { companyId } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });
    await prisma.masterCodeSequence.deleteMany({ where: { companyId } });
    await prisma.companyMembership.deleteMany({ where: { companyId } });
    await prisma.policyVersion.deleteMany({ where: { policy: { companyId } } });
    await prisma.systemPolicy.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("mencatat verifikasi PO/SP dan Win/Lost dengan aturan server", async () => {
    const outcomeCustomer = await prisma.customer.create({ data: { companyId, code: "CRM-OUTCOME", name: "Pelanggan Outcome", normalizedName: "pelanggan outcome", createdById: userId, updatedById: userId } });
    const prospect = await prisma.prospect.create({ data: { companyId, customerId: outcomeCustomer.id, code: "PRSP-OUTCOME", ownerId: userId, createdById: userId, updatedById: userId, needs: { create: [{ companyId, productId, uomId, estimatedQty: "4", createdById: userId }] } }, include: { needs: true } });
    const opportunity = await service.createOpportunity(companyId, userId, {
      prospect_id: prospect.id, period: "2026-10", source_need_ids: prospect.needs.map((n) => n.id), contact_ids: [],
    }, randomUUID());
    await expect(service.winOpportunity(companyId, userId, opportunity.id, {
      version: opportunity.version, customer_order_id: randomUUID(), maintain_strategy: "Follow up", lines: [{ opportunity_line_id: opportunity.lines[0].id, quantity: "1" }],
    })).rejects.toThrow("diverifikasi");
    const order = await service.createCustomerOrder(companyId, userId, { opportunity_id: opportunity.id, kind: "PO", reference_no: "PO-UJI-001", evidence_attachment_ids: [] }, randomUUID());
    await expect(service.winOpportunity(companyId, userId, opportunity.id, { version: opportunity.version, customer_order_id: order.id, maintain_strategy: "Follow up", lines: [{ opportunity_line_id: opportunity.lines[0].id, quantity: "1" }] })).rejects.toThrow("diverifikasi");
    await service.verifyCustomerOrder(companyId, userId, order.id);
    const won = await service.winOpportunity(companyId, userId, opportunity.id, { version: opportunity.version, customer_order_id: order.id, maintain_strategy: "Follow up", lines: [{ opportunity_line_id: opportunity.lines[0].id, quantity: "1" }] });
    expect(won.kind).toBe("WON");
    expect((await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunity.id } })).state).toBe("CLOSED_WON");

    const lostOpportunity = await service.createOpportunity(companyId, userId, {
      prospect_id: prospect.id, period: "2026-11", source_need_ids: prospect.needs.map((n) => n.id), contact_ids: [],
    }, randomUUID());
    const lost = await service.loseOpportunity(companyId, userId, lostOpportunity.id, { version: lostOpportunity.version, reason: "Anggaran ditunda", maintain_strategy: "Hubungi kembali" });
    expect(lost.kind).toBe("LOST");
    expect((await prisma.opportunity.findUniqueOrThrow({ where: { id: lostOpportunity.id } })).state).toBe("CLOSED_LOST");
    await prisma.opportunityOutcomeLine.deleteMany({ where: { companyId, outcome: { opportunityId: { in: [opportunity.id, lostOpportunity.id] } } } });
    await prisma.opportunityOutcome.deleteMany({ where: { companyId, opportunityId: { in: [opportunity.id, lostOpportunity.id] } } });
    await prisma.customerOrder.deleteMany({ where: { companyId, opportunityId: opportunity.id } });
    await prisma.opportunityLine.deleteMany({ where: { companyId, opportunityId: { in: [opportunity.id, lostOpportunity.id] } } });
    await prisma.opportunity.deleteMany({ where: { companyId, id: { in: [opportunity.id, lostOpportunity.id] } } });
    await prisma.prospectNeed.deleteMany({ where: { prospectId: prospect.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
    await prisma.customer.delete({ where: { id: outcomeCustomer.id } });
  });

  it("creates a contact with multiple PIC functions under company scope", async () => {
    const contact = await service.createContact(companyId, userId, {
      customer_id: customerId,
      full_name: "Siti Pengadaan",
      pic_functions: ["PURCHASING", "FINANCE"],
      email: "siti@example.local",
    });
    contactId = contact.id;
    expect(contact.customerId).toBe(customerId);
    expect(contact.picFunctions).toEqual(["PURCHASING", "FINANCE"]);
    expect(
      await prisma.auditEvent.count({ where: { companyId, action: "crm.contact.created" } }),
    ).toBe(1);
  });

  it("creates prospect needs without creating stock or sales records", async () => {
    const prospect = await service.createProspect(companyId, userId, {
      customer_id: customerId,
      owner_id: userId,
      source: "Kunjungan langsung",
      contact_ids: [contactId],
      needs: [
        { product_id: productId, uom_id: uomId, estimated_qty: "12.50", needed_period: "Q4" },
      ],
    });
    const need = await prisma.prospectNeed.findFirstOrThrow({ where: { prospectId: prospect.id } });
    expect(need.estimatedQty?.toString()).toBe("12.5");
    expect(prospect.contactIds).toEqual([contactId]);
    expect(await prisma.prospect.count({ where: { companyId } })).toBe(1);
    expect(
      await prisma.auditEvent.count({ where: { companyId, action: "crm.prospect.created" } }),
    ).toBe(1);
  });

  it("rejects a second prospect profile for the same institution", async () => {
    await expect(
      service.createProspect(companyId, userId, {
        customer_id: customerId,
        owner_id: userId,
        needs: [],
      }),
    ).rejects.toThrow("Pelanggan sudah memiliki profil prospek");
  });

  it("rejects a prospect contact that is not active on the selected customer", async () => {
    await expect(
      service.createProspect(companyId, userId, {
        customer_id: customerId,
        owner_id: userId,
        contact_ids: [randomUUID()],
        needs: [],
      }),
    ).rejects.toThrow("kontak tidak terdaftar pada pelanggan");
  });

  it("replays concurrent contact creates once and rejects changed payload", async () => {
    const key = randomUUID();
    const input = {
      customer_id: customerId,
      full_name: "Retry Test",
      pic_functions: ["PURCHASING"],
    };
    const [a, b] = await Promise.all([
      service.createContact(companyId, userId, input, key),
      service.createContact(companyId, userId, input, key),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      await prisma.auditEvent.count({ where: { resourceId: a.id, action: "crm.contact.created" } }),
    ).toBe(1);
    await expect(
      service.createContact(companyId, userId, { ...input, full_name: "Changed" }, key),
    ).rejects.toThrow("data berbeda");
  });

  it("paginates and filters without leaking customer tax fields or other companies", async () => {
    await prisma.customer.update({
      where: { id: customerId },
      data: { taxIdentity: "PRIVATE-TEST" },
    });
    const result = await crmPage(companyId, "prospects", {
      q: "Pelanggan CRM",
      status: "NEW",
      sort: "name",
      page: 1,
    });
    expect(result.total).toBe(1);
    expect(JSON.stringify(result)).not.toContain("PRIVATE-TEST");
    expect(JSON.stringify(result)).not.toContain("taxIdentity");
    const originalContactRead = prisma.contact.findMany;
    const contactRead = vi.spyOn(prisma.contact, "findMany");
    const masterOnly = await crmDetail(companyId, "customers", customerId, false);
    expect(masterOnly).not.toHaveProperty("contacts");
    expect(contactRead).not.toHaveBeenCalled();
    contactRead.mockRestore();
    prisma.contact.findMany = originalContactRead;
    expect(
      (await crmPage(randomUUID(), "prospects", { q: "", status: "all", sort: "updated", page: 1 }))
        .total,
    ).toBe(0);
    await expect(crmDetail(randomUUID(), "prospects", result.data[0]!.id)).rejects.toThrow(
      "tidak ditemukan",
    );
    await expect(
      crmPage(companyId, "contacts", { q: "", status: "DEFERRED", sort: "name", page: 1 }),
    ).rejects.toThrow("tidak valid");
    expect(
      (await crmPage(companyId, "prospects", { q: "", status: "all", sort: "updated", page: 2 }))
        .data,
    ).toHaveLength(0);
    expect(await crmSummary(companyId)).toEqual({
      active: 1,
      followUp: 0,
      opportunities: null,
      quotes: null,
    });
  });

  it("rejects missing reasons and concurrent stale status updates", async () => {
    const row = await prisma.prospect.findFirstOrThrow({ where: { companyId } });
    await expect(
      service.updateProspectStatus(companyId, userId, row.id, row.version, "DEFERRED"),
    ).rejects.toThrow("Alasan wajib");
    const results = await Promise.allSettled([
      service.updateProspectStatus(companyId, userId, row.id, row.version, "POTENTIAL"),
      service.updateProspectStatus(companyId, userId, row.id, row.version, "IN_PROGRESS"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      await prisma.auditEvent.count({
        where: { companyId, action: "crm.prospect.status_changed" },
      }),
    ).toBe(1);
  });

  it("adds needs once across retry and rejects stale versions and foreign references", async () => {
    const row = await prisma.prospect.findFirstOrThrow({ where: { companyId } });
    const key = randomUUID();
    const input = {
      version: row.version,
      needs: [{ description: "Kebutuhan baru", estimated_qty: null }],
    };
    const [a, b] = await Promise.all([
      service.addNeeds(companyId, userId, row.id, input, key),
      service.addNeeds(companyId, userId, row.id, input, key),
    ]);
    expect(a.version).toBe(row.version + 1);
    expect(b.version).toBe(a.version);
    expect(a.needs.filter((n) => n.description === "Kebutuhan baru")).toHaveLength(1);
    await expect(
      service.addNeeds(
        companyId,
        userId,
        row.id,
        { ...input, needs: [{ description: "Changed" }] },
        key,
      ),
    ).rejects.toThrow("data berbeda");
    await expect(service.addNeeds(companyId, userId, row.id, input, randomUUID())).rejects.toThrow(
      "berubah",
    );
    await expect(
      service.addNeeds(
        companyId,
        userId,
        row.id,
        { version: a.version, needs: [{ product_id: randomUUID() }] },
        randomUUID(),
      ),
    ).rejects.toThrow("tidak ditemukan");
    await expect(
      service.addNeeds(
        companyId,
        userId,
        row.id,
        { version: a.version, needs: [{ description: "Zero", estimated_qty: "0" }] },
        randomUUID(),
      ),
    ).rejects.toThrow("positif");
  });

  it("persists draft source snapshots once, audits and rejects mismatched sources", async () => {
    const row = await prisma.prospect.findFirstOrThrow({
      where: { companyId },
      include: { needs: true },
    });
    const key = randomUUID();
    const input = {
      prospect_id: row.id,
      period: "2026-09",
      source_need_ids: row.needs.map((n) => n.id),
      contact_ids: [],
      notes: "Draft diuji",
    };
    const [a, b] = await Promise.all([
      service.createOpportunity(companyId, userId, input, key),
      service.createOpportunity(companyId, userId, input, key),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.state).toBe("DRAFT");
    expect(a.notes).toBe("Draft diuji");
    expect(a.lines).toHaveLength(row.needs.length);
    expect(a.lines.some((l) => l.estimatedQty === null)).toBe(true);
    expect(
      await prisma.auditEvent.count({
        where: { companyId, resourceId: a.id, action: "crm.opportunity.created" },
      }),
    ).toBe(1);
    await expect(
      service.createOpportunity(companyId, userId, { ...input, notes: "Changed" }, key),
    ).rejects.toThrow("data berbeda");
    await expect(
      service.createOpportunity(
        companyId,
        userId,
        { ...input, source_need_ids: [randomUUID()] },
        randomUUID(),
      ),
    ).rejects.toThrow("prospek yang sama");
    await expect(
      service.createOpportunity(
        companyId,
        userId,
        { ...input, contact_ids: [randomUUID()] },
        randomUUID(),
      ),
    ).rejects.toThrow("institusi prospek");
    await expect(
      service.createOpportunity(randomUUID(), userId, input, randomUUID()),
    ).rejects.toThrow("tidak ditemukan");
  });

  it("creates institution and prospect atomically, reuses retry and blocks duplicates", async () => {
    const channel = await prisma.customerChannel.create({
      data: {
        companyId,
        code: "CRM-CHANNEL",
        name: "Klinik",
        normalizedName: "klinik",
        createdById: userId,
        updatedById: userId,
      },
    });
    const input = {
      new_customer: { name: "Institusi Uji Baru", channel_id: channel.id },
      owner_id: userId,
      needs: [{ description: "Kebutuhan awal" }],
    };
    const key = randomUUID();
    const a = await service.createProspect(companyId, userId, input, key);
    const b = await service.createProspect(companyId, userId, input, key);
    expect(a.id).toBe(b.id);
    expect(a.customer.relationshipStage).toBe("PROSPECT");
    expect(await prisma.customer.count({ where: { companyId, name: "Institusi Uji Baru" } })).toBe(
      1,
    );
    await expect(service.createProspect(companyId, userId, input, randomUUID())).rejects.toThrow(
      "sudah terdaftar",
    );
    await expect(
      service.createProspect(
        companyId,
        userId,
        { ...input, new_customer: { name: "Institusi Salah", channel_id: randomUUID() } },
        randomUUID(),
      ),
    ).rejects.toThrow("Channel");
    expect(await prisma.customer.count({ where: { companyId, name: "Institusi Salah" } })).toBe(0);
  });

  it("blocks creates when numbering policy is missing", async () => {
    await prisma.policyVersion.updateMany({
      where: { policy: { companyId } },
      data: { state: "RETIRED" },
    });
    await expect(
      service.createContact(companyId, userId, {
        customer_id: customerId,
        full_name: "No Policy",
        pic_functions: ["OTHER"],
      }),
    ).rejects.toThrow("Policy kode CRM belum lengkap");
    expect(await prisma.contact.count({ where: { companyId, fullName: "No Policy" } })).toBe(0);
  });
});
