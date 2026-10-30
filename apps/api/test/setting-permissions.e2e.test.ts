import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import {
  UnauthorizedException,
  NotFoundException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import request from "supertest";
import catalog from "../../../packages/database/src/data/operational-policies.json";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import { AdministrationController } from "../../../packages/backend/src/administration/administration.controller";
import { AdministrationService } from "../../../packages/backend/src/administration/administration.service";

const company = "00000000-0000-4000-8000-000000000001";
const groupOf = (code: string) => catalog.find((p) => p.code === code)?.group;

describe("Setting submenu permissions are independent", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const service = {
      async getPolicyGroup(_company: string, code: string) {
        const group = groupOf(code);
        if (!group) throw new NotFoundException();
        return group;
      },
      async listPolicies(_company: string, group: string | undefined, allowed: string[]) {
        return catalog
          .filter((p) => allowed.includes(p.group) && (!group || p.group === group))
          .map((p) => ({ code: p.code, group: p.group }));
      },
      async getPolicy(_company: string, code: string) {
        return { code, group: groupOf(code) };
      },
      async validatePolicy() {
        return { valid: true };
      },
      async updatePolicy(_c: string, _u: string, code: string) {
        return { code };
      },
    };
    const module = await Test.createTestingModule({
      controllers: [AdministrationController],
      providers: [{ provide: AdministrationService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          const access = req.headers["x-test-access"] as string | undefined;
          if (!access) throw new UnauthorizedException();
          req.auth = {
            company_id: company,
            user_id: randomUUID(),
            roles: access === "admin" ? [{ code: "ADMIN_SYSTEM" }] : [],
            permissions: access
              .split(",")
              .filter((code) => code !== "admin" && code !== "none")
              .map((code) => ({ code, scope_type: "company", scope_id: null })),
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  const patch = (code: string, access: string) =>
    request(app.getHttpServer())
      .patch(`/operational-policies/${code}`)
      .set("x-test-access", access)
      .set("if-match", '"1"')
      .send({ value: 1 });

  it("granting one Setting submenu does not open another", async () => {
    await patch("OPS-FLX-01", "setting_general.update").expect(403);
    await patch("OPS-SYS-05", "setting_general.update").expect(200);
    await patch("OPS-SYS-05", "terms_credit.update").expect(403);
    await patch("OPS-FLX-01", "terms_credit.update").expect(200);
    await patch("OPS-FLX-01", "operational_policy.update").expect(403);
  });
  it("lists only policies of readable groups", async () => {
    const res = await request(app.getHttpServer())
      .get("/operational-policies")
      .set("x-test-access", "terms_credit.read")
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p: { group: string }) => p.group === "sales")).toBe(true);
    const general = await request(app.getHttpServer())
      .get("/operational-policies")
      .set("x-test-access", "setting_general.read")
      .expect(200);
    expect(general.body.data.some((p: { group: string }) => p.group === "sales")).toBe(false);
    await request(app.getHttpServer())
      .get("/operational-policies?group=sales")
      .set("x-test-access", "setting_general.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/operational-policies")
      .set("x-test-access", "none")
      .expect(403);
  });
  it("blocks single read, validate by group; admin bypasses", async () => {
    await request(app.getHttpServer())
      .get("/operational-policies/OPS-FLX-01")
      .set("x-test-access", "setting_general.read")
      .expect(403);
    await request(app.getHttpServer())
      .post("/operational-policies/OPS-FLX-01/validate")
      .set("x-test-access", "setting_general.update")
      .send({ value: 1 })
      .expect(403);
    await patch("OPS-FLX-01", "admin").expect(200);
  });
});
