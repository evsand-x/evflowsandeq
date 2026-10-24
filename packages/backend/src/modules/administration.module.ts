import { Module } from "@nestjs/common";
import { AdministrationController } from "../administration/administration.controller";
import { AdministrationService } from "../administration/administration.service";
import { SettingsController } from "../administration/settings.controller";
import { DiscountLimitController } from "../sales/discount-limit.controller";
import { DeductionTypesController } from "../finance/deduction-types.controller";
import { IdentityModule } from "./identity.module";

@Module({
  imports: [IdentityModule],
  controllers: [AdministrationController, SettingsController, DeductionTypesController, DiscountLimitController],
  providers: [AdministrationService],
  exports: [AdministrationService],
})
export class AdministrationModule {}
