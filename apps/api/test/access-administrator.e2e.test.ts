import "reflect-metadata";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AccessController } from "../../../packages/backend/src/identity/access.controller";
import { AccessService } from "../../../packages/backend/src/identity/access.service";
import { AuthGuard } from "../../../packages/backend/src/identity/auth.guard";
import type { AuthenticatedRequest } from "../../../packages/backend/src/identity/auth.types";

describe("access administration HTTP boundary", () => {
  let app: INestApplication;
  const service = {
    listUsers: vi.fn(() => []),
    listRoles: vi.fn(() => []),
    listPermissions: vi.fn(() => []),
    deleteUser: vi.fn(async () => ({ deleted: true })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AccessController],
      providers: [{ provide: AccessService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
          const admin = req.headers["x-test-role"] === "admin";
          req.auth = {
            user_id: "test",
            membership_id: "test",
            session_id: "test",
            company_id: "company-a",
            company_name: "Test",
            display_name: "Test",
            email: "test@example.test",
            roles: [
              { code: "SALES", name: "Admin Sistem" },
              ...(admin ? [{ code: "ADMIN_SYSTEM", name: "Renamed administrator" }] : []),
            ],
            permissions: req.headers["x-test-no-permissions"]
              ? []
              : [
                  "user.read",
                  "role.read",
                  "permission.read",
                  "user.role.assign",
                  "role.permission.update",
                ].map((code) => ({
                  code,
                  scope_type: "company",
                  scope_id: req.headers["x-test-foreign-scope"] ? "company-b" : null,
                })),
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it.each(["/users", "/roles", "/permissions"])(
    "denies nonadmin read %s despite IAM permission",
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(403);
    },
  );
  it.each(["/users/target/roles", "/roles/target/permissions"])(
    "denies nonadmin mutation %s before validation/service",
    async (path) => {
      await request(app.getHttpServer()).patch(path).send({}).expect(403);
    },
  );
  it("accepts active administrator among multiple roles", async () => {
    await request(app.getHttpServer()).get("/roles").set("x-test-role", "admin").expect(200);
  });
  it("allows administrator without action permission", async () => {
    await request(app.getHttpServer())
      .get("/roles")
      .set("x-test-role", "admin")
      .set("x-test-no-permissions", "1")
      .expect(200);
  });
  it("allows administrator even when editable grants target another company", async () => {
    await request(app.getHttpServer())
      .get("/roles")
      .set("x-test-role", "admin")
      .set("x-test-foreign-scope", "1")
      .expect(200);
  });
  it("protects user deletion from nonadmins and forwards the company-bound admin request", async () => {
    const id = "c5870ae0-2ae8-43e4-ad1d-2a44171cbe31";
    await request(app.getHttpServer()).delete(`/users/${id}`).expect(403);
    await request(app.getHttpServer())
      .delete(`/users/${id}`)
      .set("x-test-role", "admin")
      .expect(200);
    expect(service.deleteUser).toHaveBeenCalledWith("company-a", "test", id);
  });
});
