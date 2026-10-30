import { randomUUID } from "node:crypto";
import { IdentityModule, OtcPtpModule } from "@evflow/backend";
import { prisma } from "@evflow/database";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { hashPassword } from "../../../packages/backend/src/identity/password";

describe("Invoice and payment HTTP authorization with real sessions (IAM-01/04)", () => {
  const companyId = randomUUID();
  const otherCompanyId = randomUUID();
  const password = "Invoice-HTTP-Test-Only-2026!";
  const actors = {
    invoice: { id: randomUUID(), grants: ["sales_invoice.read"] },
    receipt: {
      id: randomUUID(),
      grants: ["customer_receipt.read", "customer_receipt.post", "sales_invoice.view_price"],
    },
    receiptNoPrice: {
      id: randomUUID(),
      grants: ["customer_receipt.read", "customer_receipt.post"],
    },
    wrongScope: {
      id: randomUUID(),
      grants: [
        "sales_invoice.read",
        "sales_invoice.post",
        "sales_invoice.view_price",
        "customer_receipt.read",
        "customer_receipt.post",
      ],
    },
    admin: { id: randomUUID(), grants: [] as string[] },
  };
  const userIds = Object.values(actors).map((actor) => actor.id);
  let app: INestApplication | undefined;
  let fixtureDatabaseAllowed = false;

  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!);
    if (
      process.env.NODE_ENV === "production" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
    ) {
      throw new Error("Invoice HTTP fixtures require a local non-production database.");
    }
    fixtureDatabaseAllowed = true;
    await prisma.$connect();
    await prisma.company.createMany({
      data: [
        { id: companyId, name: `Invoice HTTP test ${companyId}` },
        { id: otherCompanyId, name: `Other invoice HTTP test ${otherCompanyId}` },
      ],
    });
    const passwordHash = await hashPassword(password);
    // Permission catalog entries are shared, so never rewrite existing definitions.
    const codes = [
      "sales_invoice.read",
      "sales_invoice.post",
      "sales_invoice.view_price",
      "customer_receipt.read",
      "customer_receipt.post",
    ];
    const permissions = await Promise.all(
      codes.map((code) =>
        prisma.permission.upsert({
          where: { code },
          update: {},
          create: {
            code,
            resource: code.split(".")[0]!,
            action: code.split(".")[1]!,
            description: code,
          },
        }),
      ),
    );
    for (const [name, actor] of Object.entries(actors)) {
      await prisma.user.create({
        data: {
          id: actor.id,
          email: `${actor.id}@invoice-http.evflow.local`,
          displayName: `Invoice HTTP ${name}`,
          passwordHash,
        },
      });
      const membership = await prisma.companyMembership.create({
        data: { companyId, userId: actor.id },
      });
      const role = await prisma.role.create({
        data: {
          companyId,
          code: name === "admin" ? "ADMIN_SYSTEM" : `INVOICE_HTTP_${name}`,
          name: `Invoice HTTP ${name}`,
        },
      });
      await prisma.userRole.create({
        data: { companyId, membershipId: membership.id, roleId: role.id },
      });
      await prisma.rolePermission.createMany({
        data: permissions
          .filter((p) => actor.grants.includes(p.code))
          .map((p) => ({
            companyId,
            roleId: role.id,
            permissionId: p.id,
            scopeType: "company",
            scopeId: name === "wrongScope" ? otherCompanyId : null,
          })),
      });
    }
    const module = await Test.createTestingModule({
      imports: [IdentityModule, OtcPtpModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (!fixtureDatabaseAllowed) return;
    await prisma.refreshToken.deleteMany({ where: { session: { companyId } } });
    await prisma.authSession.deleteMany({ where: { companyId } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });
    await prisma.rolePermission.deleteMany({ where: { companyId } });
    await prisma.userRole.deleteMany({ where: { companyId } });
    await prisma.role.deleteMany({ where: { companyId } });
    await prisma.companyMembership.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    await prisma.$disconnect();
  });

  async function login(name: keyof typeof actors) {
    const agent = request.agent(app!.getHttpServer());
    const csrf = (await agent.get("/api/v1/auth/csrf").expect(200)).body.data.csrf_token as string;
    const response = await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({
        email: `${actors[name].id}@invoice-http.evflow.local`,
        password,
      })
      .expect(200);
    expect(response.body.data.company_id).toBe(companyId);
    return { agent, csrf };
  }

  it("requires authentication before exposing invoice or payment endpoints", async () => {
    for (const path of [
      "sales-invoices",
      "sales-invoices/candidates",
      `sales-invoices/${randomUUID()}/payment-form`,
    ]) {
      await request(app!.getHttpServer()).get(`/api/v1/${path}`).expect(401);
    }
  });

  it("invoice read permits scoped lists but cannot mutate invoices or access payment data", async () => {
    const { agent, csrf } = await login("invoice");
    const list = await agent.get("/api/v1/sales-invoices").expect(200);
    expect(list.body.data).toMatchObject({ rows: [], total: 0 });
    await agent.get(`/api/v1/sales-invoices/${randomUUID()}`).expect(404);
    await agent.get(`/api/v1/sales-invoices/${randomUUID()}/payment-form`).expect(403);
    for (const path of [
      "sales-invoices/drafts",
      `sales-invoices/${randomUUID()}/payments`,
      `invoice-payment-deductions/${randomUUID()}/proof`,
    ]) {
      await agent
        .post(`/api/v1/${path}`)
        .set("x-csrf-token", csrf)
        .set("idempotency-key", randomUUID())
        .send({})
        .expect(403);
    }
  });

  it("receipt grants reach payment services without granting invoice list or draft access", async () => {
    const { agent, csrf } = await login("receipt");
    await agent.get("/api/v1/sales-invoices").expect(403);
    await agent.get("/api/v1/sales-invoices/candidates").expect(403);
    await agent
      .post("/api/v1/sales-invoices/drafts")
      .set("x-csrf-token", csrf)
      .set("idempotency-key", randomUUID())
      .send({})
      .expect(403);
    const form = await agent.get(`/api/v1/sales-invoices/${randomUUID()}/payment-form`).expect(404);
    expect(form.body.message).toBe("INVOICE_NOT_FOUND");
    const payment = await agent
      .post(`/api/v1/sales-invoices/${randomUUID()}/payments`)
      .set("x-csrf-token", csrf)
      .set("idempotency-key", randomUUID())
      .send({
        received_date: "2026-10-30",
        bank_account_id: randomUUID(),
        amount: "1",
        bank_reference: randomUUID(),
        evidence_id: randomUUID(),
      })
      .expect(404);
    expect(payment.body.message).toBe("INVOICE_NOT_FOUND");
  });

  it("rejects otherwise matching grants scoped to another company", async () => {
    const { agent, csrf } = await login("wrongScope");
    await agent.get("/api/v1/sales-invoices").expect(403);
    await agent.get(`/api/v1/sales-invoices/${randomUUID()}/payment-form`).expect(403);
    for (const path of ["sales-invoices/drafts", `sales-invoices/${randomUUID()}/payments`]) {
      await agent
        .post(`/api/v1/${path}`)
        .set("x-csrf-token", csrf)
        .set("idempotency-key", randomUUID())
        .send({})
        .expect(403);
    }
  });

  it("does not expose payment amounts or allow payments without price access", async () => {
    const { agent, csrf } = await login("receiptNoPrice");
    await agent.get(`/api/v1/sales-invoices/${randomUUID()}/payment-form`).expect(403);
    await agent
      .post(`/api/v1/sales-invoices/${randomUUID()}/payments`)
      .set("x-csrf-token", csrf)
      .set("idempotency-key", randomUUID())
      .send({})
      .expect(403);
  });

  it("retains Admin Sistem access and validates authorized invoice commands", async () => {
    const { agent, csrf } = await login("admin");
    expect((await agent.get("/api/v1/sales-invoices").expect(200)).body.data.rows).toEqual([]);
    expect(
      (await agent.get("/api/v1/sales-invoices/candidates").expect(200)).body.data.rows,
    ).toEqual([]);
    await agent
      .post("/api/v1/sales-invoices/drafts")
      .set("x-csrf-token", csrf)
      .set("idempotency-key", randomUUID())
      .send({})
      .expect(400);
    await agent.get(`/api/v1/sales-invoices/${randomUUID()}/payment-form`).expect(404);
    await agent.get("/api/v1/sales-invoices").query({ company_id: otherCompanyId }).expect(400);
  });
});
