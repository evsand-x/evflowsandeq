import { Module } from "@nestjs/common";
import { IdentityModule } from "./identity.module";
import { MasterController } from "../master/master.controller";
import { MasterService } from "../master/master.service";
import { AuditService } from "../common/audit.service";

@Module({
  imports: [IdentityModule],
  controllers: [MasterController],
  providers: [MasterService, AuditService],
  exports: [MasterService],
})
export class MasterModule {}
