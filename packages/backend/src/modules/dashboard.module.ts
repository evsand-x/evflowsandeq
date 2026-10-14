import { Module } from "@nestjs/common";
import { DashboardController } from "../dashboard/dashboard.controller";
import { DashboardService } from "../dashboard/dashboard.service";
import { SalesDashboardService } from "../dashboard/sales-dashboard.service";
import { WarehouseDashboardService } from "../dashboard/warehouse-dashboard.service";
import { FinanceDashboardService } from "../dashboard/finance-dashboard.service";
import { HrisDashboardService } from "../dashboard/hris-dashboard.service";
import { IdentityModule } from "./identity.module";
import { ActionQueueService } from "../dashboard/action-queue.service";
import { ReportsService } from "../dashboard/reports.service";
import { ReportsController } from "../dashboard/reports.controller";

@Module({
  imports: [IdentityModule],
  controllers: [DashboardController, ReportsController],
  providers: [
    ActionQueueService,
    ReportsService,
    DashboardService,
    SalesDashboardService,
    WarehouseDashboardService,
    FinanceDashboardService,
    HrisDashboardService,
  ],
})
export class DashboardModule {}
