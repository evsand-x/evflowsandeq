import {
  actionQueueResponseSchema,
  dashboardSummarySchema,
  salesDashboardQuerySchema,
  salesDashboardResponseSchema,
  warehouseDashboardResponseSchema,
  financeDashboardResponseSchema,
  hrisDashboardResponseSchema,
} from "@evflow/contracts";
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SalesDashboardService } from "./sales-dashboard.service";
import { WarehouseDashboardService } from "./warehouse-dashboard.service";
import { FinanceDashboardService } from "./finance-dashboard.service";
import { HrisDashboardService } from "./hris-dashboard.service";
import { AuthGuard } from "../identity/auth.guard";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { DashboardService } from "./dashboard.service";
import { ActionQueueService } from "./action-queue.service";

@Controller("dashboard")
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(
    @Inject(ActionQueueService) private readonly actions: ActionQueueService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(SalesDashboardService) private readonly sales: SalesDashboardService,
    @Inject(WarehouseDashboardService) private readonly warehouse: WarehouseDashboardService,
    @Inject(FinanceDashboardService) private readonly finance: FinanceDashboardService,
    @Inject(HrisDashboardService) private readonly hris: HrisDashboardService,
  ) {}

  @Get("actions")
  async actionQueue(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return actionQueueResponseSchema.parse({ data: await this.actions.read(request.auth, query) });
  }

  @Get("hris")
  hrisDashboard(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return hrisDashboardResponseSchema.parse({ data: this.hris.read(request.auth, query) });
  }

  @Get("finance")
  financeDashboard(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return financeDashboardResponseSchema.parse({ data: this.finance.read(request.auth, query) });
  }

  @Get("warehouse")
  async warehouseDashboard(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return warehouseDashboardResponseSchema.parse({
      data: await this.warehouse.read(request.auth, query),
    });
  }

  @Get("sales")
  async salesDashboard(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    const parsed = salesDashboardQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Filter Dashboard Sales tidak valid.");
    return salesDashboardResponseSchema.parse({
      data: await this.sales.read(request.auth, parsed.data),
    });
  }

  @Get("summary")
  async summary(@Req() request: AuthenticatedRequest) {
    return dashboardSummarySchema.parse({ data: await this.dashboard.summary(request.auth) });
  }
}
