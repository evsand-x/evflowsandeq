import type { ExecutionContext } from "@nestjs/common";
import { AccessAdministratorGuard } from "../../packages/backend/src/identity/access-administrator.guard";

describe("access workspace administrator boundary", () => {
  const guard = new AccessAdministratorGuard();
  const context = (roles: Array<{ code: string }>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          auth: { roles, permissions: [{ code: "user.read", scope_type: "company" }] },
        }),
      }),
    }) as unknown as ExecutionContext;
  it("rejects a nonadministrator even with IAM permissions", () => {
    expect(() => guard.canActivate(context([{ code: "SALES" }]))).toThrow(
      "hanya untuk Admin Sistem",
    );
  });
  it("accepts the server-authenticated active administrator role", () => {
    expect(guard.canActivate(context([{ code: "ADMIN_SYSTEM" }]))).toBe(true);
  });
});
