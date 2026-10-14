import {
  AdministrationModule,
  DashboardModule,
  FinanceModule,
  HrModule,
  IdentityModule,
  MasterModule,
  ProcurementModule,
  SalesModule,
  WarehouseModule,
  OtcPtpModule,
} from "@evflow/backend";
import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    HealthModule,
    DashboardModule,
    IdentityModule,
    AdministrationModule,
    MasterModule,
    SalesModule,
    WarehouseModule,
    ProcurementModule,
    FinanceModule,
    HrModule,
    OtcPtpModule,
  ],
})
export class AppModule {}
