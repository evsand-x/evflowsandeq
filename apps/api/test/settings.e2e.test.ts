import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import request from "supertest";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import { SettingsController } from "../../../packages/backend/src/administration/settings.controller";

const company = "00000000-0000-4000-8000-000000000001";

describe("settings HTTP authorization", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [SettingsController] })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          const scope = req.headers["x-test-access"];
          if (!scope) throw new UnauthorizedException();
          req.auth = {
            company_id: company,
            user_id: randomUUID(),
            roles: [],
            permissions:
              scope === "manage"
                ? [{ code: "numbering_rule.manage", scope_type: "company", scope_id: null }]
                : scope === "read"
                  ? [{ code: "numbering_rule.read", scope_type: "company", scope_id: null }]
                  : [],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it("rejects manage without numbering_rule.manage", async () => {
    await request(app.getHttpServer())
      .put("/settings/numbering/sales_order")
      .set("x-test-access", "read")
      .set("idempotency-key", randomUUID())
      .send({ prefix: "PJ-", digits: 5, reset_yearly: true })
      .expect(403);
  });
  it("rejects unknown kind", async () => {
    await request(app.getHttpServer())
      .put("/settings/numbering/not_a_kind")
      .set("x-test-access", "manage")
      .set("idempotency-key", randomUUID())
      .send({ prefix: "PJ-", digits: 5, reset_yearly: true })
      .expect(404);
  });
  it("requires an idempotency key", async () => {
    await request(app.getHttpServer())
      .put("/settings/numbering/sales_order")
      .set("x-test-access", "manage")
      .send({ prefix: "PJ-", digits: 5, reset_yearly: true })
      .expect(400);
  });
  it("lists numbering for readers", async () => {
    const res = await request(app.getHttpServer())
      .get("/settings/numbering")
      .set("x-test-access", "read")
      .expect(200);
    expect(
      res.body.data.find((r: { document_kind: string }) => r.document_kind === "sales_order"),
    ).toMatchObject({ label: "Sales Order", prefix: "SO-", active: true });
  });
  it("preferences returns number format for any session", async () => {
    const res = await request(app.getHttpServer())
      .get("/settings/preferences")
      .set("x-test-access", "none")
      .expect(200);
    expect(res.body.data.number_format.money_decimals).toBe(0);
    expect(res.body.data.company_name).toBe("PT LIVIANA DWI BERKAT");
  });
});
