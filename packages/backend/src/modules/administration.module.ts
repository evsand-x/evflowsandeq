import { Module } from "@nestjs/common";
import { AdministrationController } from "../administration/administration.controller";
import { AdministrationService } from "../administration/administration.service";
import { IdentityModule } from "./identity.module";

@Module({
  imports: [IdentityModule],
  controllers: [AdministrationController],
  providers: [AdministrationService],
  exports: [AdministrationService],
})
export class AdministrationModule {}
