import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import { AdministrationController } from "../../../packages/backend/src/administration/administration.controller";
import { AdministrationService } from "../../../packages/backend/src/administration/administration.service";
import { SettingsController } from "../../../packages/backend/src/administration/settings.controller";

vi.mock("../../../packages/backend/src/administration/general-settings", () => ({
  getGeneralSettings: vi.fn(async () => ({ version: 1 })),
  updateGeneralSettings: vi.fn(async (_c: string, _a: string, _v: number, input: unknown) => ({
    input,
  })),
}));

const update = vi.fn(async () => ({}));

describe("company profile vs general settings permissions", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdministrationController, SettingsController],
      providers: [{ provide: AdministrationService, useValue: { updateCompanyProfile: update } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          const code = String(req.headers["x-test-permission"] ?? "");
          req.auth = {
            company_id: randomUUID(),
            user_id: randomUUID(),
            roles: [],
            permissions: [{ code, scope_type: "company", scope_id: null }],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  const profile = (body: object) =>
    request(app.getHttpServer())
      .patch("/company-profile")
      .set("x-test-permission", "company_profile.update")
      .set("if-match", '"1"')
      .send(body);
  const general = (permission: string, body: object) =>
    request(app.getHttpServer())
      .patch("/settings/general")
      .set("x-test-permission", permission)
      .set("if-match", '"1"')
      .send(body);
  const valid = { timezone: "Asia/Jakarta", fiscal_year_start_month: 4, fiscal_year_start_day: 1 };

  it("company profile rejects timezone", async () => {
    await profile({ name: "PT Uji", timezone: "Asia/Jakarta" }).expect(400);
    await profile({ name: "PT Uji", fiscal_year_start_month: 4 }).expect(400);
    await profile({ name: "PT Uji", base_currency: "USD" }).expect(400);
  });
  it("general settings require setting_general.update", async () => {
    await general("company_profile.update", valid).expect(403);
    await general("setting_general.read", valid).expect(403);
    await general("setting_general.update", valid).expect(200);
    await request(app.getHttpServer())
      .get("/settings/general")
      .set("x-test-permission", "company_profile.read")
      .expect(403);
    await request(app.getHttpServer())
      .get("/settings/general")
      .set("x-test-permission", "setting_general.read")
      .expect(200);
  });
  it("rejects unknown timezone and out-of-range fiscal start", async () => {
    await general("setting_general.update", { ...valid, timezone: "Mars/Olympus" }).expect(400);
    await general("setting_general.update", { ...valid, fiscal_year_start_month: 13 }).expect(400);
    await general("setting_general.update", { ...valid, fiscal_year_start_day: 29 }).expect(400);
    await general("setting_general.update", { ...valid, base_currency: "USD" }).expect(400);
  });
});
