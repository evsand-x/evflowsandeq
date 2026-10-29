import { DeliveryNoteController } from "./sales/delivery-note.controller";
import { AccountsController } from "./finance/accounts.controller";
import { Module } from "@nestjs/common";
import { AuditService } from "./common/audit.service";
import { IdentityModule } from "./modules/identity.module";
import { OtcPtpController } from "./otc-ptp.controller";
import { OtcPtpService } from "./otc-ptp.service";
import { OperationsController } from "./sales/operations.controller";
import { OperationsService } from "./sales/operations.service";
import { FinanceControlsController } from "./finance/controls.controller";
import { OperationalTaxController } from "./finance/operational-tax.controller";

@Module({
  imports: [IdentityModule],
  controllers: [
    DeliveryNoteController,
    AccountsController,
    OtcPtpController,
    OperationsController,
    FinanceControlsController,
    OperationalTaxController,
  ],
  providers: [OtcPtpService, OperationsService, AuditService],
  exports: [OtcPtpService],
})
export class OtcPtpModule {}

