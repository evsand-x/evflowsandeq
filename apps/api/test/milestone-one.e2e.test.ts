import { randomUUID } from "node:crypto";
import {
  AdministrationModule,
  AdministrationService,
  DashboardModule,
  IdentityModule,
  SalesModule,
} from "@evflow/backend";
import { prisma } from "@evflow/database";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { hashPassword } from "../../../packages/backend/src/identity/password";

describe("Milestone 1 identity and setting", () => {
  const suffix = randomUUID().slice(0, 8);
  const companyId = randomUUID();
  const otherCompanyId = randomUUID();
  const adminUserId = randomUUID();
  const scopedUserId = randomUUID();
  const realPermissionCodes = [
    "company_profile.read",
    "company_profile.update",
    "operational_policy.read",
    "operational_policy.update",
    "user.role.assign",
    "user.read",
    "user.update",
    "role.read",
    "role.create",
    "role.update",
    "role.delete",
    "role.permission.update",
    "permission.read",
    "crm.read",
    "warehouse.read",
    "finance.read",
    "hr.read",
  ];
  const password = "Fictitious-Test-Password-2026!";
  let app: INestApplication;
  let adminMembershipId: string;
  let scopedMembershipId: string;
  let adminRoleId: string;
  let secondaryRoleId: string;
  let scopedRoleId: string;
  let policyId: string;
  let administrationService: AdministrationService;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.company.create({
      data: { id: companyId, name: `Company Milestone 1 ${suffix}` },
    });
    const passwordHash = await hashPassword(password);
    await prisma.user.createMany({
      data: [
        {
          id: adminUserId,
          email: `admin-${suffix}@evflow.local`,
          displayName: "Admin Milestone 1",
          passwordHash,
        },
        {
          id: scopedUserId,
          email: `scoped-${suffix}@evflow.local`,
          displayName: "Scoped Milestone 1",
          passwordHash,
        },
      ],
    });
    const [adminMembership, scopedMembership] = await Promise.all([
      prisma.companyMembership.create({ data: { companyId, userId: adminUserId } }),
      prisma.companyMembership.create({ data: { companyId, userId: scopedUserId } }),
    ]);
    adminMembershipId = adminMembership.id;
    scopedMembershipId = scopedMembership.id;

    const [adminRole, secondaryRole, scopedRole] = await Promise.all([
      prisma.role.create({
        data: { companyId, code: `TEST_ADMIN_${suffix}`, name: "Test Admin" },
      }),
      prisma.role.create({
        data: { companyId, code: `TEST_FINANCE_${suffix}`, name: "Test Finance" },
      }),
      prisma.role.create({
        data: { companyId, code: `TEST_SCOPED_${suffix}`, name: "Test Scoped" },
      }),
    ]);
    adminRoleId = adminRole.id;
    secondaryRoleId = secondaryRole.id;
    scopedRoleId = scopedRole.id;
    await prisma.userRole.createMany({
      data: [
        { companyId, membershipId: adminMembershipId, roleId: adminRoleId },
        { companyId, membershipId: adminMembershipId, roleId: secondaryRoleId },
        { companyId, membershipId: scopedMembershipId, roleId: scopedRoleId },
      ],
    });

    const permissions = [];
    for (const code of realPermissionCodes) {
      const [resource, action] = [code.split(".").slice(0, -1).join("."), code.split(".").at(-1)!];
      permissions.push(
        await prisma.permission.upsert({
          where: { code },
          update: { resource, action },
          create: {
            code,
            resource,
            action,
            description: "Milestone 1 permission",
          },
        }),
      );
    }
    await prisma.rolePermission.createMany({
      data: permissions.flatMap((permission, index) => [
        {
          companyId,
          roleId: adminRoleId,
          permissionId: permission.id,
          scopeType: "company",
        },
        ...(index === 2
          ? [
              {
                companyId,
                roleId: scopedRoleId,
                permissionId: permission.id,
                scopeType: "self",
              },
            ]
          : []),
      ]),
    });

    const policy = await prisma.systemPolicy.create({
      data: {
        companyId,
        code: "OPS-VIS-01",
        name: "Radius check-in test",
        ownerDomain: "sales",
        policyGroup: "visit",
        scope: "company",
        valueType: "integer",
        unit: "meter",
        validationSchema: { type: "integer", minimum: 1 },
        defaultValueSnapshot: 200,
      },
    });
    policyId = policy.id;
    await prisma.policyVersion.create({
      data: {
        policyId,
        versionNo: 1,
        valueSnapshot: 200,
        state: "ACTIVE",
        savedById: adminUserId,
      },
    });
    const incompletePolicy = await prisma.systemPolicy.create({
      data: {
        companyId,
        code: "OPS-FIN-04",
        name: "Toleransi pembulatan test",
        ownerDomain: "finance",
        policyGroup: "finance",
        scope: "company",
        valueType: "object",
        unit: "currency_amount",
        validationSchema: {
          type: "object",
          required: ["amount"],
          properties: {
            amount: { type: "decimal", minimum: "0" },
            account_id: { type: ["string", "null"] },
          },
          constraints: [
            {
              kind: "required_when",
              field: "account_id",
              when: { field: "amount", operator: "decimal_gt", value: "0" },
              message: "Akun pembulatan wajib bila toleransi lebih dari nol.",
            },
          ],
        },
        defaultValueSnapshot: { amount: "1", account_id: null },
      },
    });
    await prisma.policyVersion.create({
      data: {
        policyId: incompletePolicy.id,
        versionNo: 1,
        valueSnapshot: { amount: "1", account_id: null },
        state: "ACTIVE",
        savedById: adminUserId,
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [IdentityModule, AdministrationModule, DashboardModule, SalesModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    administrationService = app.get(AdministrationService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.refreshToken.deleteMany({
      where: { session: { membership: { companyId } } },
    });
    await prisma.authSession.deleteMany({ where: { membership: { companyId } } });
    await prisma.policyVersion.deleteMany({ where: { policy: { companyId } } });
    await prisma.systemPolicy.deleteMany({ where: { companyId } });
    await prisma.prospect.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.customer.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });
    await prisma.rolePermission.deleteMany({ where: { companyId } });
    await prisma.userRole.deleteMany({ where: { companyId } });
    await prisma.role.deleteMany({ where: { companyId } });
    await prisma.companyMembership.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, scopedUserId] } } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.company.deleteMany({ where: { id: otherCompanyId } });
    await prisma.$disconnect();
  });

  it("logs in with two roles and serves current effective permissions", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    const login = await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({ email: `admin-${suffix}@evflow.local`, password })
      .expect(200);

    expect(login.body.data.roles).toHaveLength(2);
    const current = await agent.get("/api/v1/auth/me").expect(200);
    expect(current.body.data.company_id).toBe(companyId);
    expect(current.body.data.roles.map((role: { code: string }) => role.code).sort()).toEqual(
      [`TEST_ADMIN_${suffix}`, `TEST_FINANCE_${suffix}`].sort(),
    );
    const users = await agent.get("/api/v1/users").expect(200);
    const admin = users.body.data.find((user: { user_id: string }) => user.user_id === adminUserId);
    expect(admin.effective_permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "company_profile.read", scope_type: "company" }),
        expect.objectContaining({ code: "operational_policy.update", scope_type: "company" }),
      ]),
    );
  });

  it("requires both edit and assignment rights, persists grants, and audits changes", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({ email: `admin-${suffix}@evflow.local`, password })
      .expect(200);
    const restricted = request.agent(app.getHttpServer());
    const restrictedCsrf = await getCsrf(restricted);
    await restricted
      .post("/api/v1/auth/login")
      .set("x-csrf-token", restrictedCsrf)
      .send({ email: `scoped-${suffix}@evflow.local`, password })
      .expect(200);
    const payload = {
      display_name: "Scoped Updated",
      email: `scoped-${suffix}@evflow.local`,
      active: true,
      role_ids: [scopedRoleId],
    };
    await restricted
      .patch(`/api/v1/users/${scopedUserId}`)
      .set("x-csrf-token", restrictedCsrf)
      .send(payload)
      .expect(403);
    await agent
      .patch(`/api/v1/users/${scopedUserId}`)
      .set("x-csrf-token", csrf)
      .send(payload)
      .expect(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: scopedUserId } });
    expect(updated.displayName).toBe("Scoped Updated");
    await agent
      .patch(`/api/v1/roles/${secondaryRoleId}`)
      .set("x-csrf-token", csrf)
      .send({ name: "Peran Kedua", description: "Data sintetis pengujian" })
      .expect(200);
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code: "crm.read" } });
    await agent
      .patch(`/api/v1/roles/${secondaryRoleId}/permissions`)
      .set("x-csrf-token", csrf)
      .send({ permissions: [{ permission_id: permission.id, scope_type: "company" }] })
      .expect(200);
    expect(
      await prisma.rolePermission.count({
        where: { roleId: secondaryRoleId, permissionId: permission.id },
      }),
    ).toBe(1);
    const audit = await prisma.auditEvent.findMany({
      where: {
        companyId,
        action: { in: ["user.updated", "role.updated", "role.permissions_changed"] },
      },
    });
    expect(audit.map((item) => item.action)).toEqual(
      expect.arrayContaining(["user.updated", "role.updated", "role.permissions_changed"]),
    );
  });

  it("serves only permitted Dashboard CRM counts from the active company", async () => {
    await prisma.company.create({
      data: { id: otherCompanyId, name: "Company dashboard isolation test" },
    });
    const ownCustomer = await prisma.customer.create({
      data: {
        companyId,
        code: `DASH-${suffix}`,
        name: "Prospek dashboard uji",
        normalizedName: `prospek-dashboard-${suffix}`,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        companyId: otherCompanyId,
        code: `OTHER-${suffix}`,
        name: "Prospek perusahaan lain",
        normalizedName: `prospek-lain-${suffix}`,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    });
    await prisma.prospect.createMany({
      data: [
        {
          companyId,
          customerId: ownCustomer.id,
          code: `DASH-${suffix}`,
          ownerId: adminUserId,
          approachStatus: "NEW",
          createdById: adminUserId,
          updatedById: adminUserId,
        },
        {
          companyId: otherCompanyId,
          customerId: otherCustomer.id,
          code: `OTHER-${suffix}`,
          ownerId: adminUserId,
          approachStatus: "POTENTIAL",
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      ],
    });
    await request(app.getHttpServer()).get("/api/v1/dashboard/summary").expect(401);
    await request(app.getHttpServer()).get("/api/v1/dashboard/sales?month=2026-09").expect(401);
    await request(app.getHttpServer()).get("/api/v1/dashboard/warehouse?month=2026-09").expect(401);
    await request(app.getHttpServer()).get("/api/v1/dashboard/finance?month=2026-09").expect(401);
    await request(app.getHttpServer()).get("/api/v1/dashboard/hris?month=2026-09").expect(401);
    for (const path of [
      "/dashboard/actions?month=2026-09",
      "/reports/catalog",
      "/report-exports",
      "/reports/ar-aging/preview?as_of=2026-09-28",
    ])
      await request(app.getHttpServer()).get(`/api/v1${path}`).expect(401);
    const admin = request.agent(app.getHttpServer());
    const adminCsrf = await getCsrf(admin);
    await admin
      .post("/api/v1/auth/login")
      .set("x-csrf-token", adminCsrf)
      .send({ email: `admin-${suffix}@evflow.local`, password })
      .expect(200);
    const result = await admin.get("/api/v1/dashboard/summary").expect(200);
    const actions = await admin
      .get("/api/v1/dashboard/actions?month=2026-09&tab=followups")
      .expect(200);
    expect(actions.body.data.owner_id).toBe(adminUserId);
    expect(actions.body.data.metrics.approvals.value).toBeNull();
    await admin
      .get(`/api/v1/dashboard/actions?month=2026-09&company_id=${otherCompanyId}`)
      .expect(400);
    const catalog = await admin.get("/api/v1/reports/catalog").expect(200);
    expect(catalog.body.data.items).toHaveLength(5);
    const preview = await admin
      .get("/api/v1/reports/ar-aging/preview?as_of=2026-09-28")
      .expect(200);
    expect(preview.body.data.status).toBe("unavailable");
    await admin.get("/api/v1/reports/ar-aging/preview?as_of=2026-02-30").expect(400);
    const exports = await admin.get("/api/v1/report-exports").expect(200);
    expect(exports.body.data.requested_by).toBe(adminUserId);
    expect(exports.body.data.total).toBeNull();
    await admin.post("/api/v1/reports/ar-aging/exports").send({ as_of: "2026-09-28" }).expect(401);
    await admin
      .post("/api/v1/reports/ar-aging/exports")
      .set("x-csrf-token", adminCsrf)
      .send({ as_of: "2026-09-28" })
      .expect(409);
    expect(result.body.data.company_id).toBe(companyId);
    const hris = await admin
      .get("/api/v1/dashboard/hris?month=2026-09&process=payroll")
      .expect(200);
    expect(hris.body.data.company_id).toBe(companyId);
    expect(hris.body.data.process).toBe("payroll");
    expect(
      hris.body.data.metrics.every((metric: { value: unknown }) => metric.value === null),
    ).toBe(true);
    expect(hris.body.data.processes.payroll_run.value).toBeNull();
    expect(hris.body.data.total_actions).toBeNull();
    expect(hris.body.data).not.toHaveProperty("payroll_amount");
    await admin.get("/api/v1/dashboard/hris?month=2026-13").expect(400);
    await admin
      .get(`/api/v1/dashboard/hris?month=2026-09&company_id=${otherCompanyId}`)
      .expect(400);
    const finance = await admin
      .get("/api/v1/dashboard/finance?month=2026-09&process=closing")
      .expect(200);
    expect(finance.body.data.company_id).toBe(companyId);
    expect(finance.body.data.process).toBe("closing");
    expect(
      finance.body.data.metrics.every((metric: { value: unknown }) => metric.value === null),
    ).toBe(true);
    expect(finance.body.data.closing.period_status.value).toBeNull();
    expect(finance.body.data.total_actions).toBeNull();
    await admin.get("/api/v1/dashboard/finance?month=2026-13").expect(400);
    await admin
      .get(`/api/v1/dashboard/finance?month=2026-09&company_id=${otherCompanyId}`)
      .expect(400);
    const warehouse = await admin.get("/api/v1/dashboard/warehouse?month=2026-09").expect(200);
    expect(warehouse.body.data.company_id).toBe(companyId);
    expect(warehouse.body.data.freshness).toBe("unavailable");
    expect(warehouse.body.data.total_actions).toBeNull();
    expect(warehouse.body.data.warehouses).toEqual([]);
    await admin.get("/api/v1/dashboard/warehouse?month=2026-13").expect(400);
    await admin
      .get(`/api/v1/dashboard/warehouse?month=2026-09&company_id=${otherCompanyId}`)
      .expect(400);
    await admin
      .get(`/api/v1/dashboard/warehouse?month=2026-09&warehouse_id=${randomUUID()}`)
      .expect(403);
    const sales = await admin.get("/api/v1/dashboard/sales?month=2026-09").expect(200);
    expect(sales.body.data.company_id).toBe(companyId);
    expect(sales.body.data.owner_id).toBe(adminUserId);
    expect(sales.body.data.metrics).toHaveLength(7);
    expect(
      sales.body.data.metrics.every((metric: { value: unknown }) => metric.value === null),
    ).toBe(true);
    await admin.get("/api/v1/dashboard/sales?month=2026-13").expect(400);
    await admin
      .get(`/api/v1/dashboard/sales?month=2026-09&company_id=${otherCompanyId}`)
      .expect(400);
    expect(result.body.data.sales.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prospects_total",
          value: 1,
          unit: "institusi",
          freshness: "fresh",
        }),
        expect.objectContaining({ code: "prospects_new", value: 1 }),
        expect.objectContaining({ code: "prospects_potential", value: 0 }),
      ]),
    );
    const scoped = request.agent(app.getHttpServer());
    const scopedCsrf = await getCsrf(scoped);
    await scoped
      .post("/api/v1/auth/login")
      .set("x-csrf-token", scopedCsrf)
      .send({ email: `scoped-${suffix}@evflow.local`, password })
      .expect(200);
    const restricted = await scoped.get("/api/v1/dashboard/summary").expect(200);
    expect(restricted.body.data.sales).toBeNull();
    await scoped.get("/api/v1/dashboard/sales?month=2026-09").expect(403);
    await scoped.get("/api/v1/dashboard/warehouse?month=2026-09").expect(403);
    await scoped.get("/api/v1/dashboard/finance?month=2026-09").expect(403);
    await scoped.get("/api/v1/dashboard/hris?month=2026-09").expect(403);
    expect((await scoped.get("/api/v1/reports/catalog").expect(200)).body.data.items).toEqual([]);
    expect(
      (await scoped.get("/api/v1/dashboard/actions?month=2026-09&tab=followups").expect(200)).body
        .data.items,
    ).toEqual([]);
    await scoped.get("/api/v1/reports/ar-aging/preview?as_of=2026-09-28").expect(403);
    await scoped
      .post("/api/v1/reports/ar-aging/exports")
      .set("x-csrf-token", scopedCsrf)
      .send({ as_of: "2026-09-28" })
      .expect(403);
  });

  it("rotates refresh tokens and revokes the session family when an old token is reused", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    const login = await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({ email: `admin-${suffix}@evflow.local`, password })
      .expect(200);
    const oldRefreshCookie = cookieFrom(login.headers["set-cookie"], "refresh_token");
    const csrfCookie = `csrf_token=${csrf}`;

    await agent.post("/api/v1/auth/refresh").set("x-csrf-token", csrf).expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("cookie", `${csrfCookie}; ${oldRefreshCookie}`)
      .set("x-csrf-token", csrf)
      .expect(401);

    const stored = await prisma.refreshToken.findFirst({
      where: { session: { membershipId: adminMembershipId }, consumedAt: { not: null } },
      include: { session: true },
      orderBy: { consumedAt: "desc" },
    });
    expect(stored?.session.revokedReason).toBe("refresh_token_reuse");
  });

  it("does not disclose whether a login account has an inactive membership", async () => {
    await prisma.companyMembership.update({
      where: { id: scopedMembershipId },
      data: { active: false },
    });
    try {
      const agent = request.agent(app.getHttpServer());
      const csrf = await getCsrf(agent);
      const inactive = await agent
        .post("/api/v1/auth/login")
        .set("x-csrf-token", csrf)
        .send({ email: `scoped-${suffix}@evflow.local`, password })
        .expect(401);
      const unknown = await agent
        .post("/api/v1/auth/login")
        .set("x-csrf-token", csrf)
        .send({ email: `missing-${suffix}@evflow.local`, password })
        .expect(401);
      expect(inactive.body.message).toBe(unknown.body.message);
    } finally {
      await prisma.companyMembership.update({
        where: { id: scopedMembershipId },
        data: { active: true },
      });
    }
  });

  it("clears cookies on logout even when only an expired or invalid access cookie remains", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    const response = await agent
      .post("/api/v1/auth/logout")
      .set("cookie", `csrf_token=${csrf}; access_token=invalid`)
      .set("x-csrf-token", csrf)
      .expect(204);
    expect(cookieFrom(response.headers["set-cookie"], "access_token")).toContain("access_token=");
    expect(cookieFrom(response.headers["set-cookie"], "refresh_token")).toContain("refresh_token=");
  });

  it("rejects a matching permission code when its scope is only self", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({ email: `scoped-${suffix}@evflow.local`, password })
      .expect(200);
    await agent.get("/api/v1/operational-policies").expect(403);
  });

  it("updates company profile and policy with optimistic versions and audit evidence", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({ email: `admin-${suffix}@evflow.local`, password })
      .expect(200);

    await agent
      .patch("/api/v1/company-profile")
      .set("x-csrf-token", csrf)
      .set("if-match", '"1"')
      .send({ name: `Company Updated ${suffix}`, address: "Alamat uji fiktif" })
      .expect(200);
    await agent
      .patch("/api/v1/company-profile")
      .set("x-csrf-token", csrf)
      .set("if-match", '"1"')
      .send({ name: "Stale update" })
      .expect(412);

    await agent
      .patch("/api/v1/operational-policies/OPS-VIS-01")
      .set("x-csrf-token", csrf)
      .set("if-match", '"1"')
      .send({ value: 250 })
      .expect(200);
    await agent
      .patch("/api/v1/operational-policies/OPS-VIS-01")
      .set("x-csrf-token", csrf)
      .set("if-match", '"1"')
      .send({ value: 300 })
      .expect(412);

    await agent
      .patch(`/api/v1/users/${scopedUserId}/roles`)
      .set("x-csrf-token", csrf)
      .send({ role_ids: [scopedRoleId, secondaryRoleId] })
      .expect(200);

    const evidence = await prisma.auditEvent.findMany({
      where: {
        companyId,
        action: {
          in: [
            "company_profile.updated",
            "operational_policy.version_activated",
            "user.roles_changed",
          ],
        },
      },
    });
    expect(evidence.map((event) => event.action).sort()).toEqual([
      "company_profile.updated",
      "operational_policy.version_activated",
      "user.roles_changed",
    ]);
    expect(evidence.every((event) => event.beforeHash && event.afterHash)).toBe(true);
    const revokedScopedSessions = await prisma.authSession.count({
      where: {
        membershipId: scopedMembershipId,
        revokedReason: "role_assignment_changed",
      },
    });
    expect(revokedScopedSessions).toBeGreaterThan(0);
  });

  it("serves CRM reads with guards and never elevates CRM read to write or master access", async () => {
    await request(app.getHttpServer()).get("/api/v1/crm/workspace/prospects").expect(401);
    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({ email: `admin-${suffix}@evflow.local`, password })
      .expect(200);
    const result = await agent
      .get("/api/v1/crm/workspace/prospects?q=&status=all&page=1&sort=name")
      .expect(200);
    expect(result.body.page_size).toBe(20);
    expect(result.body.data.every((r: { company_id: string }) => r.company_id === companyId)).toBe(
      true,
    );
    await agent.get("/api/v1/crm/workspace/prospects?page=0").expect(400);
    await agent.get("/api/v1/crm/workspace/contacts?status=DEFERRED").expect(400);
    await agent.get("/api/v1/crm/workspace/prospects/not-a-uuid").expect(400);
    await agent.get(`/api/v1/crm/workspace/prospects/${randomUUID()}`).expect(404);
    await agent.get("/api/v1/crm/master/customers").expect(403);
    await agent.get("/api/v1/crm/options").expect(403);
    await agent.post("/api/v1/crm/contacts").set("x-csrf-token", csrf).send({}).expect(403);
    await agent
      .patch(`/api/v1/crm/prospects/${randomUUID()}/status`)
      .set("x-csrf-token", csrf)
      .set("if-match", '"1"')
      .send({ approach_status: "NEW" })
      .expect(403);
  });

  it("blocks an incomplete mandatory policy and returns a versioned snapshot after correction", async () => {
    await expect(
      administrationService.requirePolicySnapshot(companyId, "OPS-FIN-04"),
    ).rejects.toThrow("belum lengkap");

    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrf)
      .send({ email: `admin-${suffix}@evflow.local`, password })
      .expect(200);
    const accountId = randomUUID();
    await agent
      .patch("/api/v1/operational-policies/OPS-FIN-04")
      .set("x-csrf-token", csrf)
      .set("if-match", '"1"')
      .send({ value: { amount: "1", account_id: accountId } })
      .expect(200);

    const snapshot = await administrationService.requirePolicySnapshot(companyId, "OPS-FIN-04");
    expect(snapshot).toMatchObject({
      code: "OPS-FIN-04",
      version_no: 2,
      value: { amount: "1", account_id: accountId },
    });
  });
});

async function getCsrf(agent: ReturnType<typeof request.agent>) {
  const response = await agent.get("/api/v1/auth/csrf").expect(200);
  return response.body.data.csrf_token as string;
}

function cookieFrom(setCookie: string | string[] | undefined, name: string) {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const value = values.find((cookie) => cookie.startsWith(`${name}=`))?.split(";")[0];
  if (!value) throw new Error(`Cookie ${name} tidak ditemukan.`);
  return value;
}
