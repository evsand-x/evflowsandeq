import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { type ExecutionContext, type INestApplication } from "@nestjs/common";
import request from "supertest";
import { prisma } from "@evflow/database";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import { OtcPtpController } from "../../../packages/backend/src/otc-ptp.controller";
import { OtcPtpService } from "../../../packages/backend/src/otc-ptp.service";
import { FinanceControlsController } from "../../../packages/backend/src/finance/controls.controller";
import { OperationsController } from "../../../packages/backend/src/sales/operations.controller";
import { OperationsService } from "../../../packages/backend/src/sales/operations.service";

describe("SO advance HTTP permissions", () => {
  let app: INestApplication;
  const c = randomUUID(),
    a = randomUUID(),
    id = randomUUID();
  const commands = {
    recordSalesOrderAdvance: vi.fn(),
    verifySalesOrderAdvance: vi.fn(),
    rejectSalesOrderAdvance: vi.fn(),
  };
  const operations = { upload: vi.fn(), evidence: vi.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OtcPtpController, FinanceControlsController, OperationsController],
      providers: [
        { provide: OtcPtpService, useValue: commands },
        { provide: OperationsService, useValue: operations },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          req.auth = {
            user_id: a,
            company_id: c,
            roles: [],
            permissions: [
              {
                code: req.headers["x-permission"],
                scope_type: req.headers["x-scope"] ?? "company",
                scope_id: req.headers["x-company"] ?? c,
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
  afterAll(async () => app.close());
  afterEach(() => vi.restoreAllMocks());
  it.each([
    ["sales-orders", "advances", "sales_order_advance.create"],
    ["sales-order-advances", "verify", "sales_order_advance.verify"],
    ["sales-order-advances", "reject", "sales_order_advance.verify"],
  ])("enforces independent action %s/%s", async (base, action, permission) => {
    const path = `/${base}/${id}/${action}`;
    for (const denied of [
      "sales_order.read",
      "customer_receipt.post",
      permission === "sales_order_advance.create"
        ? "sales_order_advance.verify"
        : "sales_order_advance.create",
    ])
      await request(app.getHttpServer())
        .post(path)
        .set("x-permission", denied)
        .set("Idempotency-Key", randomUUID())
        .send({ version: 1 })
        .expect(403);
    await request(app.getHttpServer())
      .post(path)
      .set("x-permission", permission!)
      .set("x-company", randomUUID())
      .set("Idempotency-Key", randomUUID())
      .send({ version: 1 })
      .expect(403);
    await request(app.getHttpServer())
      .post(path)
      .set("x-permission", permission!)
      .set("Idempotency-Key", randomUUID())
      .send({ version: 1 })
      .expect(201);
  });
  it.each(["sales_order_advance.create", "sales_order_advance.verify"])(
    "allows scoped bank options for %s",
    async (permission) => {
      const spy = vi.spyOn(prisma.financeBankAccount, "findMany").mockResolvedValue([]);
      await request(app.getHttpServer())
        .get("/finance-controls/banks")
        .set("x-permission", permission)
        .expect(200);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: c, active: true } }),
      );
      await request(app.getHttpServer())
        .get("/finance-controls/banks")
        .set("x-permission", permission)
        .set("x-scope", "self")
        .expect(403);
    },
  );
  it("allows recorder PAYMENT upload and only SO-linked evidence read for advance permissions", async () => {
    operations.upload.mockResolvedValue({ id });
    operations.evidence.mockResolvedValue({ id });
    await request(app.getHttpServer())
      .post("/operations/evidence")
      .set("x-permission", "sales_order_advance.create")
      .send({ purpose: "PAYMENT", name: "receipt.png", base64: "YQ==" })
      .expect(201);
    vi.spyOn(prisma.transactionEvidence, "findFirst").mockResolvedValue({
      id,
      purpose: "PAYMENT",
      actorId: a,
    } as never);
    const linked = vi
      .spyOn(prisma.salesOrderAdvance, "findFirst")
      .mockResolvedValue({ id } as never);
    await request(app.getHttpServer())
      .get(`/operations/evidence/${id}`)
      .set("x-permission", "sales_order_advance.verify")
      .expect(200);
    linked.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/operations/evidence/${id}`)
      .set("x-permission", "sales_order_advance.verify")
      .expect(403);
    await request(app.getHttpServer())
      .get(`/operations/evidence/${id}`)
      .set("x-permission", "sales_order_advance.create")
      .expect(200);
  });
});
