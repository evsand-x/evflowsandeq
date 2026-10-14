import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import request from "supertest";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import { OtcPtpController } from "../../../packages/backend/src/otc-ptp.controller";
import { OtcPtpService } from "../../../packages/backend/src/otc-ptp.service";
import { OperationsController } from "../../../packages/backend/src/sales/operations.controller";
import { OperationsService } from "../../../packages/backend/src/sales/operations.service";
import * as proforma from "../../../packages/backend/src/sales/proforma";

describe("manual proforma HTTP authorization", () => {
  let app: INestApplication;
  const id = randomUUID(),
    company = randomUUID(),
    actor = randomUUID();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OtcPtpController, OperationsController],
      providers: [
        { provide: OtcPtpService, useValue: {} },
        { provide: OperationsService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          if (!req.headers["x-test-access"]) throw new UnauthorizedException();
          const scope = req.headers["x-test-access"];
          req.auth = {
            company_id: company,
            user_id: actor,
            permissions: [
              {
                code: scope === "submit-only" ? "sales_order.submit" : "proforma.issue",
                scope_type: scope === "self" ? "self" : "company",
                scope_id: scope === "foreign" ? randomUUID() : company,
              },
            ],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => app.close());

  it.each(["submit-only", "self", "foreign"])(
    "denies preview and issuance for %s",
    async (scope) => {
      const preview = vi.spyOn(proforma, "previewProforma");
      const issue = vi.spyOn(proforma, "issueProforma");
      await request(app.getHttpServer())
        .get(`/operations/fulfillment-batches/${id}/proforma-preview`)
        .set("x-test-access", scope)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/fulfillment-batches/${id}/issue-proforma`)
        .set("x-test-access", scope)
        .send({})
        .expect(403);
      expect(preview).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
    },
  );
  it("requires a session and an idempotency key; forwards scoped authorized issuance", async () => {
    await request(app.getHttpServer())
      .get(`/operations/fulfillment-batches/${id}/proforma-preview`)
      .expect(401);
    const issue = vi
      .spyOn(proforma, "issueProforma")
      .mockResolvedValue({ id: randomUUID() } as never);
    await request(app.getHttpServer())
      .post(`/fulfillment-batches/${id}/issue-proforma`)
      .set("x-test-access", "company")
      .send({ version: "a".repeat(64) })
      .expect(400);
    const key = randomUUID();
    await request(app.getHttpServer())
      .post(`/fulfillment-batches/${id}/issue-proforma`)
      .set("x-test-access", "company")
      .set("Idempotency-Key", key)
      .send({ version: "a".repeat(64) })
      .expect(201);
    expect(issue).toHaveBeenCalledWith(company, actor, id, { version: "a".repeat(64) }, key);
  });
});
