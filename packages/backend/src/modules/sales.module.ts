import { Module } from "@nestjs/common";
import { AuditService } from "../common/audit.service";
import { CrmController } from "../crm/crm.controller";
import { CrmService } from "../crm/crm.service";
import { IdentityModule } from "./identity.module";

@Module({
  imports: [IdentityModule],
  controllers: [CrmController],
  providers: [CrmService, AuditService],
  exports: [CrmService],
})
export class SalesModule {}
