import { randomUUID } from "node:crypto";
import { IdentityModule, SalesModule } from "@evflow/backend";
import { prisma } from "@evflow/database";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { hashPassword } from "../../../packages/backend/src/identity/password";

describe("CRM first operational flow HTTP", () => {
  const companyId = randomUUID(),
    userId = randomUUID(),
    roleId = randomUUID();
  const email = `crm-flow-${userId}@example.invalid`;
  const password = "Only-Test-Fixture-2026!";
  let app: INestApplication;
  let channelId: string;
  beforeAll(async () => {
    await prisma.company.create({ data: { id: companyId, name: "CRM HTTP Fixture" } });
    await prisma.user.create({
      data: {
        id: userId,
        email,
        displayName: "CRM Tester",
        passwordHash: await hashPassword(password),
      },
    });
    const member = await prisma.companyMembership.create({ data: { companyId, userId } });
    await prisma.role.create({
      data: { id: roleId, companyId, code: "CRM_TEST", name: "CRM Test" },
    });
    await prisma.userRole.create({ data: { companyId, membershipId: member.id, roleId } });
    for (const code of ["crm.read", "crm.create"]) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.create({
        data: { companyId, roleId, permissionId: permission.id, scopeType: "company" },
      });
    }
    const channel = await prisma.customerChannel.create({
      data: {
        companyId,
        code: "CLINIC",
        name: "Klinik",
        normalizedName: "klinik",
        createdById: userId,
        updatedById: userId,
      },
    });
    channelId = channel.id;
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
            savedById: userId,
            valueSnapshot: {
              sequence_length: 6,
              customer: "CUS",
              contact: "CON",
              prospect: "PRSP",
              opportunity: "OPP",
            },
          },
        },
      },
    });
    const module = await Test.createTestingModule({
      imports: [IdentityModule, SalesModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await prisma.opportunityLine.deleteMany({ where: { companyId } });
    await prisma.opportunity.deleteMany({ where: { companyId } });
    await prisma.prospectNeed.deleteMany({ where: { companyId } });
    await prisma.prospect.deleteMany({ where: { companyId } });
    await prisma.contact.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
    await prisma.customerChannel.deleteMany({ where: { companyId } });
    await prisma.refreshToken.deleteMany({ where: { session: { membership: { companyId } } } });
    await prisma.authSession.deleteMany({ where: { membership: { companyId } } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });
    await prisma.policyVersion.deleteMany({ where: { policy: { companyId } } });
    await prisma.systemPolicy.deleteMany({ where: { companyId } });
    await prisma.masterCodeSequence.deleteMany({ where: { companyId } });
    await prisma.rolePermission.deleteMany({ where: { companyId } });
    await prisma.userRole.deleteMany({ where: { companyId } });
    await prisma.role.deleteMany({ where: { companyId } });
    await prisma.companyMembership.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });
  it("authenticates, creates institution/prospect/contact/needs/draft and reads the saved snapshot", async () => {
    const server = app.getHttpServer(),
      agent = request.agent(server);
    await request(server).post("/api/v1/crm/opportunities").send({}).expect(401);
    const csrf = (await agent.get("/api/v1/auth/csrf").expect(200)).body.data.csrf_token;
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({ email, password })
      .expect(200);
    const post = (url: string, key: string, body: object) =>
      agent.post(`/api/v1${url}`).set("x-csrf-token", csrf).set("idempotency-key", key).send(body);
    const prospect = (
      await post("/crm/prospects", randomUUID(), {
        new_customer: { name: "Institusi HTTP", channel_id: channelId },
        owner_id: userId,
        needs: [{ description: "Kebutuhan awal" }],
      }).expect(201)
    ).body.data;
    const contact = (
      await post("/crm/contacts", randomUUID(), {
        customer_id: prospect.customer_id,
        full_name: "PIC HTTP",
        pic_functions: ["PURCHASING"],
      }).expect(201)
    ).body.data;
    const detail = (await agent.get(`/api/v1/crm/workspace/prospects/${prospect.id}`).expect(200))
      .body.data;
    expect(detail.contacts[0].id).toBe(contact.id);
    const addKey = randomUUID(),
      addBody = { version: detail.version, needs: [{ description: "Kebutuhan tambahan" }] };
    const added = (await post(`/crm/prospects/${prospect.id}/needs`, addKey, addBody).expect(201))
      .body.data;
    await post(`/crm/prospects/${prospect.id}/needs`, addKey, addBody).expect(201);
    expect(added.needs).toHaveLength(2);
    await post(`/crm/prospects/${prospect.id}/needs`, randomUUID(), addBody).expect(412);
    const key = randomUUID(),
      payload = {
        prospect_id: prospect.id,
        period: "2026-09",
        source_need_ids: added.needs.map((n: { id: string }) => n.id),
        contact_ids: [contact.id],
        notes: "HTTP draft",
      };
    const draft = (await post("/crm/opportunities", key, payload).expect(201)).body.data;
    const replay = (await post("/crm/opportunities", key, payload).expect(201)).body.data;
    expect(replay.id).toBe(draft.id);
    await post("/crm/opportunities", key, { ...payload, notes: "Changed" }).expect(409);
    await post("/crm/opportunities", randomUUID(), { ...payload, stage: "CLOSED_WON" }).expect(400);
    await post("/crm/opportunities", randomUUID(), {
      ...payload,
      source_need_ids: [randomUUID()],
    }).expect(409);
    await agent
      .post("/api/v1/crm/opportunities")
      .set("idempotency-key", randomUUID())
      .send(payload)
      .expect(401);
    const read = (await agent.get(`/api/v1/crm/prospects/${prospect.id}/opportunities`).expect(200))
      .body.data;
    expect(read).toHaveLength(1);
    expect(read[0].state).toBe("DRAFT");
    expect(read[0].lines).toHaveLength(2);
    expect(read[0].contact_ids).toEqual([contact.id]);
    expect(read[0].notes).toBe("HTTP draft");
    const createPermission = await prisma.permission.findUniqueOrThrow({
      where: { code: "crm.create" },
    });
    await prisma.rolePermission.deleteMany({
      where: { companyId, roleId, permissionId: createPermission.id },
    });
    await post("/crm/opportunities", randomUUID(), payload).expect(403);
  });
});

