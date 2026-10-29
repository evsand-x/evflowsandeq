import { DeliveryNoteController } from "../../../packages/backend/src/sales/delivery-note.controller";
import { AccountsController } from "../../../packages/backend/src/finance/accounts.controller";
import { FinanceControlsController } from "../../../packages/backend/src/finance/controls.controller";
import { OperationalTaxController } from "../../../packages/backend/src/finance/operational-tax.controller";
import "reflect-metadata";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma } from "@evflow/database";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import type { AuthenticatedRequest } from "../../../packages/backend/src/identity/auth.types";
import { CrmController } from "../../../packages/backend/src/crm/crm.controller";
import { CrmService } from "../../../packages/backend/src/crm/crm.service";
import { MasterController } from "../../../packages/backend/src/master/master.controller";
import { MasterService } from "../../../packages/backend/src/master/master.service";
import { OperationsController } from "../../../packages/backend/src/sales/operations.controller";
import { OperationsService } from "../../../packages/backend/src/sales/operations.service";
import { OtcPtpService } from "../../../packages/backend/src/otc-ptp.service";

describe("independent submenu HTTP permissions", () => {
  let app: INestApplication;
  const crm = { list: vi.fn(async () => []) };
  const master = { listMasters: vi.fn(async () => []), listReference: vi.fn(async () => []) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        DeliveryNoteController,
        AccountsController,
        FinanceControlsController,
        CrmController,
        MasterController,
        OperationsController,
        OperationalTaxController,
      ],
      providers: [
        { provide: CrmService, useValue: crm },
        { provide: MasterService, useValue: master },
        {
          provide: OperationsService,
          useValue: {
            batch: vi.fn(async () => ({ id: "batch" })),
            proforma: vi.fn(async () => ({ id: "proforma" })),
          list: vi.fn(async () => ({ rows: [], total: 0 })),
          },
        },
        { provide: OtcPtpService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
          req.auth = {
            user_id: "test",
            membership_id: "test",
            session_id: "test",
            company_id: "company-a",
            company_name: "Test",
            display_name: "Test",
            email: "test@example.invalid",
            roles: [{ code: req.headers["x-admin"] ? "ADMIN_SYSTEM" : "TEST", name: "Test" }],
            permissions: String(req.headers["x-permissions"] ?? "")
              .split(",")
              .filter(Boolean)
              .map((code) => ({
                code,
                scope_type: "company",
                scope_id: req.headers["x-foreign"] ? "company-b" : null,
              })),
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  it("rejects SO-only principals on every Surat Jalan endpoint", async () => {
    for (const grants of [
      "sales_order.read,sales_order.create,sales_order.submit",
      "sales_invoice.read,sales_invoice.post",
    ]) {
      await request(app.getHttpServer())
        .get("/delivery-notes")
        .set("x-permissions", grants)
        .expect(403);
      await request(app.getHttpServer())
        .get("/delivery-notes/00000000-0000-4000-8000-000000000001")
        .set("x-permissions", grants)
        .expect(403);
      await request(app.getHttpServer())
        .get("/delivery-notes/orders/00000000-0000-4000-8000-000000000001/delivered")
        .set("x-permissions", grants)
        .expect(403);
      await request(app.getHttpServer())
        .post("/delivery-notes")
        .set("x-permissions", grants)
        .send({})
        .expect(403);
      await request(app.getHttpServer())
        .patch("/delivery-notes/00000000-0000-4000-8000-000000000001")
        .set("x-permissions", grants)
        .send({})
        .expect(403);
      await request(app.getHttpServer())
        .post("/delivery-notes/00000000-0000-4000-8000-000000000001/issue")
        .set("x-permissions", grants)
        .send({})
        .expect(403);
    }
  });
  it("requires independent account permissions and scopes list queries", async () => {
    await request(app.getHttpServer())
      .post("/finance-controls/configuration/account")
      .set("x-permissions", "account_mapping.manage")
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .get("/accounts")
      .set("x-permissions", "posting_profile.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/accounts")
      .set("x-permissions", "account.read")
      .set("x-foreign", "yes")
      .expect(403);
    await request(app.getHttpServer())
      .post("/accounts")
      .set("x-permissions", "account.read")
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .get("/accounts?page=0")
      .set("x-permissions", "account.read")
      .expect(400);
    const find = vi.spyOn(prisma.financeAccount, "findMany").mockResolvedValue([]);
    const count = vi.spyOn(prisma.financeAccount, "count").mockResolvedValue(0);
    const transaction = vi.spyOn(prisma, "$transaction").mockResolvedValue([[], 0]);
    try {
      await request(app.getHttpServer())
        .get("/accounts?category=LIABILITY&page=2")
        .set("x-permissions", "account.read")
        .expect(200);
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: "company-a", category: "LIABILITY" }),
          skip: 25,
          take: 25,
        }),
      );
    } finally {
      find.mockRestore();
      count.mockRestore();
      transaction.mockRestore();
    }
  });
  it("guards the account mapping endpoints with account_mapping.read/manage only", async () => {
    // The retired posting_profile.* grants no longer open Setting > Pemetaan Akun.
    await request(app.getHttpServer())
      .get("/finance-controls/configuration")
      .set("x-permissions", "posting_profile.read")
      .expect(403);
    await request(app.getHttpServer())
      .post("/finance-controls/configuration/profile")
      .set("x-permissions", "posting_profile.manage")
      .send({})
      .expect(403);
    // account_mapping.read alone never writes: account_mapping.manage required.
    await request(app.getHttpServer())
      .post("/finance-controls/configuration/profile")
      .set("x-permissions", "account_mapping.read")
      .send({})
      .expect(403);
    const accounts = vi.spyOn(prisma.financeAccount, "findMany").mockResolvedValue([]);
    const periods = vi.spyOn(prisma.financePeriod, "findMany").mockResolvedValue([]);
    const profiles = vi.spyOn(prisma.financePostingProfile, "findMany").mockResolvedValue([]);
    try {
      await request(app.getHttpServer())
        .get("/finance-controls/configuration")
        .set("x-permissions", "account_mapping.read")
        .expect(200);
    } finally {
      accounts.mockRestore();
      periods.mockRestore();
      profiles.mockRestore();
    }
  });
  it("keeps period and bank setup independent of account_mapping.manage", async () => {
    for (const kind of ["period", "bank"])
      await request(app.getHttpServer())
        .post(`/finance-controls/configuration/${kind}`)
        .set("x-permissions", "account_mapping.manage")
        .send({})
        .expect(403);
    // period kind requires the period permission: passes the guard (body then fails validation, not 403).
    const res = await request(app.getHttpServer())
      .post("/finance-controls/configuration/period")
      .set("x-permissions", "finance_period.close")
      .send({});
    expect(res.status).not.toBe(403);
    await request(app.getHttpServer())
      .post("/finance-controls/configuration/bank")
      .set("x-permissions", "finance_period.close,account_mapping.manage")
      .send({})
      .expect(403);
  });
  it("mapping reader gets account options without account.read; other sections stay hidden", async () => {
    const accounts = vi
      .spyOn(prisma.financeAccount, "findMany")
      .mockResolvedValue([{ id: "a" }] as never);
    const periods = vi
      .spyOn(prisma.financePeriod, "findMany")
      .mockResolvedValue([{ id: "p" }] as never);
    const profiles = vi
      .spyOn(prisma.financePostingProfile, "findMany")
      .mockResolvedValue([{ id: "f" }] as never);
    try {
      const mapping = await request(app.getHttpServer())
        .get("/finance-controls/configuration")
        .set("x-permissions", "account_mapping.read")
        .expect(200);
      expect(mapping.body.data).toEqual({
        accounts: [],
        account_options: [{ id: "a" }],
        periods: [],
        profiles: [{ id: "f" }],
      });
      expect(accounts).toHaveBeenCalledTimes(1);
      expect(accounts).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ active: true, accountType: "DETAIL" }),
          select: { id: true, code: true, name: true },
        }),
      );
      const chart = await request(app.getHttpServer())
        .get("/finance-controls/configuration")
        .set("x-permissions", "account.read")
        .expect(200);
      expect(chart.body.data).toEqual({
        accounts: [{ id: "a" }],
        account_options: [],
        periods: [],
        profiles: [],
      });
      await request(app.getHttpServer())
        .get("/finance-controls/configuration")
        .set("x-permissions", "journal.read")
        .expect(403);
    } finally {
      accounts.mockRestore();
      periods.mockRestore();
      profiles.mockRestore();
    }
  });
  it("isolates all three tax menus and scopes their source reads", async () => {
    for (const [route, permission] of [
      // The tax master lives in Setting > Pajak (tax_setting.*); faktur menus keep their own grants.
      ["master", "tax_setting.read"],
      ["invoices/output", "tax_output.read"],
      ["invoices/input", "tax_input.read"],
    ]) {
      await request(app.getHttpServer())
        .get(`/tax/${route}`)
        .set("x-permissions", "tax_rule.read")
        .expect(403);
      await request(app.getHttpServer())
        .get(`/tax/${route}`)
        .set("x-permissions", permission!)
        .set("x-foreign", "yes")
        .expect(403);
      await request(app.getHttpServer())
        .get(`/tax/${route}?page=0`)
        .set("x-permissions", permission!)
        .expect(400);
    }
    await request(app.getHttpServer())
      .get("/tax/invoices/input")
      .set("x-permissions", "tax_output.read")
      .expect(403);
    // Retired Finance tax master grants and faktur grants open nothing on the tax master.
    for (const retired of [
      "tax_master.read",
      "tax_master.create",
      "tax_master.update",
      "tax_output.read",
    ])
      await request(app.getHttpServer())
        .get("/tax/master")
        .set("x-permissions", retired)
        .expect(403);
    for (const path of ["/tax/master", "/tax/master/00000000-0000-4000-8000-000000000001/default"])
      for (const grant of ["tax_setting.read", "tax_master.create", "tax_master.update"])
        await request(app.getHttpServer())
          .post(path)
          .set("x-permissions", grant)
          .send({})
          .expect(403);
    for (const route of ["invoices/output", "invoices/input"])
      await request(app.getHttpServer())
        .get(`/tax/${route}`)
        .set("x-permissions", "tax_setting.read")
        .expect(403);
    await request(app.getHttpServer())
      .post("/tax/invoices/output/00000000-0000-4000-8000-000000000001")
      .set("x-permissions", "tax_input.update")
      .send({})
      .expect(403);
    const find = vi.spyOn(prisma.salesInvoice, "findMany").mockResolvedValue([]);
    const count = vi.spyOn(prisma.salesInvoice, "count").mockResolvedValue(0);
    const docs = vi.spyOn(prisma.operationalTaxInvoice, "findMany").mockResolvedValue([]);
    const legacy = vi.spyOn(prisma.officialTaxDocument, "findMany").mockResolvedValue([]);
    try {
      await request(app.getHttpServer())
        .get("/tax/invoices/output")
        .set("x-permissions", "tax_output.read")
        .expect(200);
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: "company-a" } }),
      );
    } finally {
      find.mockRestore();
      count.mockRestore();
      docs.mockRestore();
      legacy.mockRestore();
    }
  });
  it("lists opportunities with its own grant and company-scoped pagination", async () => {
    await request(app.getHttpServer())
      .get("/crm/workspace/opportunities")
      .set("x-permissions", "crm_prospect.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/crm/workspace/opportunities")
      .set("x-permissions", "crm_opportunity.read")
      .set("x-foreign", "yes")
      .expect(403);
    const find = vi.spyOn(prisma.opportunity, "findMany").mockResolvedValue([]);
    const count = vi.spyOn(prisma.opportunity, "count").mockResolvedValue(0);
    const transaction = vi.spyOn(prisma, "$transaction").mockResolvedValue([[], 0]);
    try {
      await request(app.getHttpServer())
        .get("/crm/workspace/opportunities?q=Klinik&page=2")
        .set("x-permissions", "crm_opportunity.read")
        .expect(200);
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: "company-a" }),
          take: 20,
          skip: 20,
        }),
      );
      await request(app.getHttpServer())
        .get("/crm/workspace/opportunities?page=0")
        .set("x-permissions", "crm_opportunity.read")
        .expect(400);
    } finally {
      find.mockRestore();
      count.mockRestore();
      transaction.mockRestore();
    }
  });
  it("allows Prospek without Kontak, then Kontak without Prospek", async () => {
    for (const [resource, other, code] of [
      ["prospects", "contacts", "crm_prospect.read"],
      ["contacts", "prospects", "crm_contact.read"],
    ]) {
      await request(app.getHttpServer())
        .get(`/crm/${resource}`)
        .set("x-permissions", code!)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/crm/${other}`)
        .set("x-permissions", code!)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/crm/workspace/${other}`)
        .set("x-permissions", code!)
        .expect(403);
    }
  });
  it("does not accept retired parent grants or foreign company scope", async () => {
    await request(app.getHttpServer())
      .get("/crm/contacts")
      .set("x-permissions", "crm.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/master-data/customers")
      .set("x-permissions", "master_data.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/crm/contacts")
      .set("x-permissions", "crm_contact.read")
      .set("x-foreign", "yes")
      .expect(403);
  });
  it("keeps master resources and CRM customer projection independent", async () => {
    await request(app.getHttpServer())
      .get("/master-data/customers")
      .set("x-permissions", "master_customer.read")
      .expect(200);
    await request(app.getHttpServer())
      .get("/master-data/products")
      .set("x-permissions", "master_customer.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/crm/master/customers")
      .set("x-permissions", "master_customer.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/master-data/customers")
      .set("x-permissions", "crm_customer.read")
      .expect(403);
  });
  it("checks mutations and related data before calling services", async () => {
    await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("x-permissions", "crm_prospect.create")
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .patch("/crm/contacts/123")
      .set("x-permissions", "crm_prospect.update")
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post("/master-data/products")
      .set("x-permissions", "master_customer.create")
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .get("/crm/attachments/contact/123")
      .set("x-permissions", "crm_prospect.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/crm/activities/contact/123")
      .set("x-permissions", "crm_activity.read,crm_prospect.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/crm/options?resource=contacts")
      .set("x-permissions", "crm_prospect.create")
      .expect(403);
  });
  it("rejects arbitrary resource keys, including prototype properties", async () => {
    for (const resource of ["__proto__", "constructor", "unknown"]) {
      await request(app.getHttpServer()).get(`/crm/${resource}`).set("x-admin", "1").expect(403);
    }
  });
  it("supports combined grants and keeps Admin Sistem independent of grants", async () => {
    for (const path of ["/crm/prospects", "/crm/contacts"]) {
      await request(app.getHttpServer())
        .get(path)
        .set("x-permissions", "crm_prospect.read,crm_contact.read")
        .expect(200);
      await request(app.getHttpServer()).get(path).set("x-admin", "1").expect(200);
    }
  });
  it("isolates each outbound stage and refuses the retired fulfillment grant", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    for (const [stage, permission] of [
      ["picking", "outbound_picking.read"],
      ["checking", "outbound_checking.read"],
      ["shipping", "outbound_shipping.read"],
      ["pod", "delivery_receipt.read"],
    ]) {
      await request(app.getHttpServer())
        .get(`/operations/outbound/${stage}/${id}`)
        .set("x-permissions", permission!)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/operations/outbound/${stage}/${id}`)
        .set("x-permissions", "fulfillment.read")
        .expect(403);
      const other = stage === "picking" ? "checking" : "picking";
      await request(app.getHttpServer())
        .get(`/operations/outbound/${other}/${id}`)
        .set("x-permissions", permission!)
        .expect(403);
    }
  });
  it("does not invent a delivery_note grant and keeps Surat Jalan on outbound shipping", async () => {
    await request(app.getHttpServer())
      .get("/operations/outbound/shipping/00000000-0000-4000-8000-000000000001")
      .set("x-permissions", "delivery_note.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/operations/outbound/shipping/00000000-0000-4000-8000-000000000001")
      .set("x-permissions", "outbound_shipping.read")
      .expect(200);
  });
  it("keeps SO, Surat Jalan and Invoice HTTP grants independent", async () => {
    const find = vi.spyOn(prisma.deliveryNote, "findMany").mockResolvedValue([]);
    const count = vi.spyOn(prisma.deliveryNote, "count").mockResolvedValue(0);
    const matrix = [
      {
        name: "SO",
        path: "/operations/lists/orders?page=1",
        grant: "sales_order.read",
        denied: ["outbound_shipping.read", "sales_invoice.read"],
      },
      {
        name: "Surat Jalan",
        path: "/delivery-notes?page=1",
        grant: "outbound_shipping.read",
        denied: ["sales_order.read", "sales_invoice.read"],
      },
      {
        name: "Invoice",
        path: "/operations/lists/invoices?page=1",
        grant: "sales_invoice.read",
        denied: ["sales_order.read", "outbound_shipping.read"],
      },
    ];
    try {
      for (const entry of matrix) {
        await request(app.getHttpServer())
          .get(entry.path)
          .set("x-permissions", entry.grant)
          .expect(200);
        for (const denied of entry.denied) {
          await request(app.getHttpServer())
            .get(entry.path)
            .set("x-permissions", denied)
            .expect(403);
        }
      }
    } finally {
      find.mockRestore();
      count.mockRestore();
    }
  });
  it("requires independent Proforma and Backorder read capabilities", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    await request(app.getHttpServer())
      .get(`/operations/proformas/${id}`)
      .set("x-permissions", "proforma.read")
      .expect(200);
    for (const path of [
      `/operations/proformas/${id}`,
      "/operations/backorders",
      "/operations/warehouse-backorders",
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .set("x-permissions", "sales_order.read")
        .expect(403);
    }
    await request(app.getHttpServer())
      .get("/operations/backorders")
      .set("x-permissions", "warehouse_allocation.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/operations/warehouse-backorders")
      .set("x-permissions", "sales_backorder.read")
      .expect(403);
  });
});
