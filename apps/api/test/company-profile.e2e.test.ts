import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import { AdministrationController } from "../../../packages/backend/src/administration/administration.controller";
import { AdministrationService } from "../../../packages/backend/src/administration/administration.service";

const update = vi.fn(async (_c: string, _a: string, _v: number, input: unknown) => ({ input }));

describe("PATCH /company-profile general fields", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdministrationController],
      providers: [{ provide: AdministrationService, useValue: { updateCompanyProfile: update } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          ctx.switchToHttp().getRequest().auth = {
            company_id: randomUUID(),
            user_id: randomUUID(),
            roles: [],
            permissions: [
              { code: "company_profile.update", scope_type: "company", scope_id: null },
            ],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  const patch = (body: object) =>
    request(app.getHttpServer()).patch("/company-profile").set("if-match", '"1"').send(body);

  it("rejects unknown timezone", async () => {
    await patch({ name: "PT Uji", timezone: "Mars/Olympus" }).expect(400);
  });
  it("rejects fiscal year start outside range", async () => {
    await patch({ name: "PT Uji", fiscal_year_start_month: 13 }).expect(400);
    await patch({ name: "PT Uji", fiscal_year_start_day: 29 }).expect(400);
  });
  it("accepts a valid IANA timezone and fiscal start", async () => {
    await patch({
      name: "PT Uji",
      timezone: "Asia/Jakarta",
      fiscal_year_start_month: 4,
      fiscal_year_start_day: 1,
    }).expect(200);
    expect(update.mock.calls.at(-1)![3]).toMatchObject({ timezone: "Asia/Jakarta" });
  });
  it("does not accept base currency changes", async () => {
    await patch({ name: "PT Uji", base_currency: "USD" }).expect(400);
  });
});
