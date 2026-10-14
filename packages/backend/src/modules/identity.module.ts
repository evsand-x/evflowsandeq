import { Module } from "@nestjs/common";
import { AuditService } from "../common/audit.service";
import { AccessController } from "../identity/access.controller";
import { AccessService } from "../identity/access.service";
import { AccessAdministratorGuard } from "../identity/access-administrator.guard";
import { AuthController } from "../identity/auth.controller";
import { AuthGuard } from "../identity/auth.guard";
import { AuthService } from "../identity/auth.service";
import { PermissionGuard } from "../identity/permission.guard";

@Module({
  controllers: [AuthController, AccessController],
  providers: [
    AuthService,
    AuthGuard,
    AccessAdministratorGuard,
    PermissionGuard,
    AccessService,
    AuditService,
  ],
  exports: [AuthService, AuthGuard, PermissionGuard, AuditService],
})
export class IdentityModule {}
