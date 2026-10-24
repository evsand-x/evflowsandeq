import { Module } from "@nestjs/common";
import { AdministrationController } from "../administration/administration.controller";
import { AdministrationService } from "../administration/administration.service";
import { SettingsController } from "../administration/settings.controller";
import { DeductionTypesController } from "../finance/deduction-types.controller";
import { IdentityModule } from "./identity.module";

@Module({
  imports: [IdentityModule],
  controllers: [AdministrationController, SettingsController, DeductionTypesController],
  providers: [AdministrationService],
  exports: [AdministrationService],
})
export class AdministrationModule {}
