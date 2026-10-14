import { Module } from "@nestjs/common";
import { AuditService } from "./common/audit.service";
import { IdentityModule } from "./modules/identity.module";
import { OtcPtpController } from "./otc-ptp.controller";
import { OtcPtpService } from "./otc-ptp.service";
import { OperationsController } from "./sales/operations.controller";
import { OperationsService } from "./sales/operations.service";
import { FinanceControlsController } from "./finance/controls.controller";

@Module({
  imports: [IdentityModule],
  controllers: [OtcPtpController, OperationsController, FinanceControlsController],
  providers: [OtcPtpService, OperationsService, AuditService],
  exports: [OtcPtpService],
})
export class OtcPtpModule {}
