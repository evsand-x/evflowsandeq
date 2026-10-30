import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import request from "supertest";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import { DeductionTypesController } from "../../../packages/backend/src/finance/deduction-types.controller";

const company = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000009";

describe("Setting > Jenis Potongan permissions", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [DeductionTypesController] })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          const access = req.headers["x-test-access"] as string | undefined;
          if (!access) throw new UnauthorizedException();
          req.auth = {
            company_id: company,
            user_id: randomUUID(),
            roles: [],
            permissions: access
              .split(",")
              .filter((code) => code !== "none")
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

  const server = () => request(app.getHttpServer());

  it("requires authentication", async () => {
    await server().get("/settings/deduction-types").expect(401);
  });

  it("deduction_type.manage is required to write", async () => {
    const body = { name: "X", settle_account_id: id, proof_type: "NONE", proof_required: false };
    for (const access of [
      "none",
      "deduction_type.read",
      "tax_setting.update",
      "terms_credit.update",
    ]) {
      await server()
        .post("/settings/deduction-types")
        .set("x-test-access", access)
        .send(body)
        .expect(403);
      await server()
        .patch(`/settings/deduction-types/${id}`)
        .set("x-test-access", access)
        .set("if-match", '"1"')
        .send(body)
        .expect(403);
    }
  });

  it("deduction_type.read is required to read, and manage does not imply it", async () => {
    for (const path of ["", "/accounts"])
      for (const access of ["deduction_type.manage", "tax_setting.read"])
        await server()
          .get(`/settings/deduction-types${path}`)
          .set("x-test-access", access)
          .expect(403);
  });

  it("PATCH without If-Match is a bad request", async () => {
    await server()
      .patch(`/settings/deduction-types/${id}`)
      .set("x-test-access", "deduction_type.manage")
      .send({})
      .expect(400);
  });
});
