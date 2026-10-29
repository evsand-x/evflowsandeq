import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import {
  UnauthorizedException,
  ConflictException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { salesOrderDisplayStatusSchema } from "@evflow/contracts";
import request from "supertest";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import type { AuthenticatedRequest } from "../../../packages/backend/src/identity/auth.types";
import { OperationsController } from "../../../packages/backend/src/sales/operations.controller";
import { OperationsService } from "../../../packages/backend/src/sales/operations.service";
import { OtcPtpService } from "../../../packages/backend/src/otc-ptp.service";
import * as availability from "../../../packages/backend/src/sales/order-availability";
import { ProblemDetailsFilter } from "../src/problem-details.filter";

describe("SO form and list HTTP authorization", () => {
  let app: INestApplication;
  const company = randomUUID(),
    actor = randomUUID(),
    membership = randomUUID(),
    foreignCompany = randomUUID();
  const warehouse = randomUUID(),
    product = randomUUID();
  const service = { lookups: vi.fn(), list: vi.fn() };
  const stockPath = `/operations/stock-availability?warehouse_id=${warehouse}&product_ids=${product}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [
        { provide: OperationsService, useValue: service },
        { provide: OtcPtpService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
          const access = req.headers["x-test-access"];
          if (typeof access !== "string") throw new UnauthorizedException();
          const [action, scope = "company"] = access.split(":");
          req.auth = {
            user_id: actor,
            membership_id: membership,
            company_id: company,
            company_name: "HTTP test company",
            display_name: "HTTP tester",
            email: "tester@example.invalid",
            session_id: randomUUID(),
            roles: action === "admin" ? [{ code: "ADMIN_SYSTEM", name: "Admin Sistem" }] : [],
            permissions:
              action === "admin"
                ? []
                : [
                    {
                      code: `sales_order.${action}`,
                      scope_type: scope === "self" ? "self" : "company",
                      scope_id: scope === "foreign" ? foreignCompany : company,
                    },
                  ],
          };
          req.auth_source = "bearer";
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });
  beforeEach(() => {
    service.lookups
      .mockReset()
      .mockResolvedValue({ warehouses: [], salespeople: [], terms: [], defaults: {} });
    service.list.mockReset().mockResolvedValue({ rows: [], total: 0 });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => app.close());

  it("keeps a safe Setting link at the root of configuration problem responses", async () => {
    service.lookups.mockRejectedValueOnce(
      new ConflictException({
        code: "ORDER_WAREHOUSE_REQUIRED",
        message: "Pilih gudang penjualan.",
        settings_href: "/setting/sales",
      }),
    );
    const response = await request(app.getHttpServer())
      .get("/operations/order-options")
      .set("x-test-access", "create")
      .expect(409);
    expect(response.body).toMatchObject({
      detail: "Pilih gudang penjualan.",
      settings_href: "/setting/sales",
      errors: { code: "ORDER_WAREHOUSE_REQUIRED" },
    });
  });

  it.each([stockPath, "/operations/order-options", "/operations/lists/orders"])(
    "requires authentication for %s",
    async (path) => {
      const stock = vi.spyOn(availability, "stockAvailability");
      await request(app.getHttpServer()).get(path).expect(401);
      expect(stock).not.toHaveBeenCalled();
      expect(service.lookups).not.toHaveBeenCalled();
      expect(service.list).not.toHaveBeenCalled();
    },
  );

  it.each(["read", "update", "create:foreign", "create:self"])(
    "rejects stock requests with %s",
    async (access) => {
      const stock = vi.spyOn(availability, "stockAvailability");
      await request(app.getHttpServer()).get(stockPath).set("x-test-access", access).expect(403);
      expect(stock).not.toHaveBeenCalled();
    },
  );

  it.each(["create", "admin"])("forwards company-scoped stock requests with %s", async (access) => {
    const rows = [{ productId: product, available: "86", elsewhere: [] }];
    const stock = vi.spyOn(availability, "stockAvailability").mockResolvedValue(rows);
    const response = await request(app.getHttpServer())
      .get(stockPath)
      .set("x-test-access", access)
      .expect(200);
    expect(response.body).toEqual({ data: rows });
    expect(stock).toHaveBeenCalledExactlyOnceWith(company, warehouse, [product]);
  });

  it.each(["read", "create:foreign", "create:self", "update:foreign", "update:self"])(
    "rejects form options with %s",
    async (access) => {
      await request(app.getHttpServer())
        .get("/operations/order-options")
        .set("x-test-access", access)
        .expect(403);
      expect(service.lookups).not.toHaveBeenCalled();
    },
  );

  it.each(["create", "update", "admin"])(
    "allows same-company form options with %s",
    async (access) => {
      await request(app.getHttpServer())
        .get("/operations/order-options")
        .set("x-test-access", access)
        .expect(200);
      expect(service.lookups).toHaveBeenCalledExactlyOnceWith(company);
    },
  );

  it.each(salesOrderDisplayStatusSchema.options)(
    "forwards display status %s to the list service",
    async (status) => {
      await request(app.getHttpServer())
        .get(`/operations/lists/orders?status=${status}`)
        .set("x-test-access", "read")
        .expect(200);
      expect(service.list).toHaveBeenCalledExactlyOnceWith(
        company,
        "orders",
        1,
        "",
        undefined,
        undefined,
        undefined,
        { status },
        false,
        false,
      );
    },
  );

  it("refuses the uninvoiced queue without sales invoice access", async () => {
    await request(app.getHttpServer())
      .get("/operations/lists/orders?queue=UNINVOICED")
      .set("x-test-access", "read")
      .expect(403);
    expect(service.list).not.toHaveBeenCalled();
  });

  it.each(["create", "read:self", "read:foreign"])(
    "rejects list access with %s",
    async (access) => {
      await request(app.getHttpServer())
        .get("/operations/lists/orders?status=OPEN")
        .set("x-test-access", access)
        .expect(403);
      expect(service.list).not.toHaveBeenCalled();
    },
  );

  it("returns problem details 400 for an invalid display status", async () => {
    const response = await request(app.getHttpServer())
      .get("/operations/lists/orders?status=UNKNOWN")
      .set("x-test-access", "read")
      .expect(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({ status: 400, code: "BAD_REQUEST" });
    expect(service.list).not.toHaveBeenCalled();
  });

  it.each(["not-a-uuid", Array.from({ length: 101 }, () => randomUUID()).join(",")])(
    "validates stock product ids before reading stock",
    async (productIds) => {
      const stock = vi.spyOn(availability, "stockAvailability");
      await request(app.getHttpServer())
        .get(`/operations/stock-availability?warehouse_id=${warehouse}&product_ids=${productIds}`)
        .set("x-test-access", "create")
        .expect(400);
      expect(stock).not.toHaveBeenCalled();
    },
  );
});
