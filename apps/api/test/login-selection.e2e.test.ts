import { randomUUID } from "node:crypto";
import { AdministrationModule, IdentityModule } from "@evflow/backend";
import { companySelectionRequiredSchema } from "@evflow/contracts";
import { prisma } from "@evflow/database";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { hashPassword } from "../../../packages/backend/src/identity/password";
import { ProblemDetailsFilter } from "../src/problem-details.filter";

describe("Multi-company login selection", () => {
  const userId = randomUUID();
  const email = `selection-${userId}@evflow.local`;
  const password = "Fictitious-Selection-Password-2026!";
  const companies = [
    { id: randomUUID(), name: "DATA UJI FIKTIF Zulu" },
    { id: randomUUID(), name: "DATA UJI FIKTIF Alpha" },
    { id: randomUUID(), name: "DATA UJI FIKTIF Alpha" },
    { id: randomUUID(), name: "DATA UJI FIKTIF Inactive" },
    { id: randomUUID(), name: "DATA UJI FIKTIF Foreign" },
  ];
  const companyIds = companies.map((company) => company.id);
  const selectedCompany = companies[0]!;
  const inactiveCompany = companies[3]!;
  const foreignCompany = companies[4]!;
  const expectedOptions = companies.slice(0, 3).sort((left, right) => {
    const leftKey = `${left.name}:${left.id}`;
    const rightKey = `${right.name}:${right.id}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  let app: INestApplication;
  let passwordHash: string;
  let selectedMembershipId: string;

  beforeAll(async () => {
    await prisma.$connect();
    passwordHash = await hashPassword(password);
    await prisma.company.createMany({ data: companies });
    await prisma.user.create({
      data: { id: userId, email, passwordHash, displayName: "DATA UJI FIKTIF Selection" },
    });
    await prisma.companyMembership.createMany({
      data: companies.slice(0, 4).map((company, index) => ({
        companyId: company.id,
        userId,
        active: index < 3,
      })),
    });
    const membership = await prisma.companyMembership.findUniqueOrThrow({
      where: { companyId_userId: { companyId: selectedCompany.id, userId } },
    });
    selectedMembershipId = membership.id;
    const permission = await prisma.permission.upsert({
      where: { code: "company_profile.read" },
      update: {},
      create: {
        code: "company_profile.read",
        resource: "company_profile",
        action: "read",
        description: "Lihat profil perusahaan",
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: selectedCompany.id,
        code: "SELECTION_READER",
        name: "DATA UJI FIKTIF Reader",
        rolePermissions: {
          create: {
            permissionId: permission.id,
            scopeType: "company",
            scopeId: selectedCompany.id,
          },
        },
      },
    });
    await prisma.userRole.create({
      data: { companyId: selectedCompany.id, membershipId: membership.id, roleId: role.id },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [IdentityModule, AdministrationModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany({ where: { session: { companyId: { in: companyIds } } } });
    await prisma.authSession.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.auditEvent.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.user.update({ where: { id: userId }, data: { active: true, passwordHash } });
    await prisma.companyMembership.updateMany({
      where: { userId, companyId: { in: companies.slice(0, 3).map((company) => company.id) } },
      data: { active: true },
    });
  });

  afterAll(async () => {
    await app?.close();
    await prisma.refreshToken.deleteMany({ where: { session: { companyId: { in: companyIds } } } });
    await prisma.authSession.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.auditEvent.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.rolePermission.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.userRole.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.role.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyMembership.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
  });

  async function client() {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/csrf").expect(200);
    return {
      agent,
      login: (overrides: { email?: string; password?: string; company_id?: string } = {}) =>
        agent
          .post("/api/v1/auth/login")
          .set("x-csrf-token", csrf.body.data.csrf_token)
          .send({ email, password, ...overrides }),
    };
  }

  async function expectNoSession() {
    expect(await prisma.authSession.count({ where: { companyId: { in: companyIds } } })).toBe(0);
    expect(
      await prisma.refreshToken.count({ where: { session: { companyId: { in: companyIds } } } }),
    ).toBe(0);
    expect(
      await prisma.auditEvent.count({ where: { actorId: userId, action: "auth.login" } }),
    ).toBe(0);
  }

  function expectCredentialFailure(response: request.Response) {
    expect(response.status).toBe(401);
    expect(response.body.detail).toBe("Email atau kata sandi tidak sesuai.");
    expect(response.body.code).toBe("UNAUTHORIZED");
    expect(response.body.companies).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("DATA UJI FIKTIF");
    expect(response.headers["set-cookie"]).toBeUndefined();
  }

  it("returns only sorted active company options without creating sessions or cookies", async () => {
    const { agent, login } = await client();
    for (const attempt of [1, 2]) {
      const response = await login().expect(409);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.body).toEqual({
        type: "urn:evflow:problem:conflict",
        title: "CONFLICT",
        status: 409,
        code: "COMPANY_SELECTION_REQUIRED",
        detail: "Pilih perusahaan untuk melanjutkan.",
        request_id: expect.any(String),
        companies: expectedOptions,
      });
      expect(companySelectionRequiredSchema.parse(response.body).companies).toEqual(
        expectedOptions,
      );
      expect(response.headers["set-cookie"], `attempt ${attempt}`).toBeUndefined();
    }
    await expectNoSession();
    await agent.get("/api/v1/auth/me").expect(401);
  });

  it.each(["unknown user", "wrong password", "inactive user", "no active membership"])(
    "does not disclose companies for %s",
    async (scenario) => {
      if (scenario === "inactive user") {
        await prisma.user.update({ where: { id: userId }, data: { active: false } });
      }
      if (scenario === "no active membership") {
        await prisma.companyMembership.updateMany({ where: { userId }, data: { active: false } });
      }
      const { login } = await client();
      expectCredentialFailure(
        await login({
          ...(scenario === "unknown user" ? { email: `missing-${email}` } : {}),
          ...(scenario === "wrong password" ? { password: "Wrong-Password-2026!" } : {}),
        }),
      );
      await expectNoSession();
    },
  );

  it.each(["foreign", "inactive", "nonexistent", "revoked", "wrong password", "changed password"])(
    "rechecks credentials and membership for a %s selection",
    async (scenario) => {
      const { login } = await client();
      await login().expect(409);
      if (scenario === "revoked") {
        await prisma.companyMembership.update({
          where: { id: selectedMembershipId },
          data: { active: false },
        });
      }
      if (scenario === "changed password") {
        await prisma.user.update({
          where: { id: userId },
          data: { passwordHash: await hashPassword("Changed-Password-2026!") },
        });
      }
      const companyId =
        scenario === "foreign"
          ? foreignCompany.id
          : scenario === "inactive"
            ? inactiveCompany.id
            : scenario === "nonexistent"
              ? randomUUID()
              : selectedCompany.id;
      expectCredentialFailure(
        await login({
          company_id: companyId,
          ...(scenario === "wrong password" ? { password: "Wrong-Password-2026!" } : {}),
        }),
      );
      await expectNoSession();
    },
  );

  it("creates the selected session, refresh token and audit with only the selected scope", async () => {
    const { agent, login } = await client();
    await login().expect(409);
    const response = await login({ company_id: selectedCompany.id }).expect(200);
    expect(response.body.data).toMatchObject({
      user_id: userId,
      membership_id: selectedMembershipId,
      company_id: selectedCompany.id,
      company_name: selectedCompany.name,
      permissions: [
        { code: "company_profile.read", scope_type: "company", scope_id: selectedCompany.id },
      ],
    });
    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies).toHaveLength(2);
    expect(
      cookies.some((cookie) => cookie.startsWith("access_token=") && cookie.includes("HttpOnly")),
    ).toBe(true);
    expect(
      cookies.some((cookie) => cookie.startsWith("refresh_token=") && cookie.includes("HttpOnly")),
    ).toBe(true);
    const sessions = await prisma.authSession.findMany({ where: { membership: { userId } } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      companyId: selectedCompany.id,
      membershipId: selectedMembershipId,
      revokedAt: null,
    });
    expect(await prisma.refreshToken.count({ where: { sessionId: sessions[0]!.id } })).toBe(1);
    const audits = await prisma.auditEvent.findMany({
      where: { actorId: userId, action: "auth.login" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      companyId: selectedCompany.id,
      resourceId: sessions[0]!.id,
      resourceType: "auth_session",
    });
    const me = await agent.get("/api/v1/auth/me").expect(200);
    expect(me.body.data).toEqual(response.body.data);
    const profile = await agent.get("/api/v1/company-profile").expect(200);
    expect(profile.body.data.id).toBe(selectedCompany.id);
    await prisma.companyMembership.update({
      where: { id: selectedMembershipId },
      data: { active: false },
    });
    await agent.get("/api/v1/auth/me").expect(401);
    await agent.get("/api/v1/company-profile").expect(401);
  });

  it("does not borrow permissions from another company", async () => {
    const { agent, login } = await client();
    const response = await login({ company_id: companies[1]!.id }).expect(200);
    expect(response.body.data.company_id).toBe(companies[1]!.id);
    expect(response.body.data.roles).toEqual([]);
    expect(response.body.data.permissions).toEqual([]);
    const denied = await agent.get("/api/v1/company-profile").expect(403);
    expect(denied.body).toMatchObject({ code: "FORBIDDEN", errors: { statusCode: 403 } });
    expect(denied.body.companies).toBeUndefined();
  });

  it("keeps single-active-company login working without selection", async () => {
    await prisma.companyMembership.updateMany({
      where: { userId, id: { not: selectedMembershipId } },
      data: { active: false },
    });
    const { login } = await client();
    const response = await login().expect(200);
    expect(response.body.data.company_id).toBe(selectedCompany.id);
  });
});
