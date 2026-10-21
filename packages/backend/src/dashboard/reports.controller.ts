import {
  reportCatalogResponseSchema,
  reportExportsResponseSchema,
  reportPreviewResponseSchema,
} from "@evflow/contracts";
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../identity/auth.guard";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { ReportsService } from "./reports.service";
import { requireDashboardView } from "./workspace-access";

@Controller()
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}
  @Get("reports/catalog")
  catalog(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
    requireDashboardView(req.auth, "reports");
    return reportCatalogResponseSchema.parse({ data: this.reports.catalog(req.auth, query) });
  }
  @Get("reports/:code/preview")
  preview(@Req() req: AuthenticatedRequest, @Param("code") code: string, @Query() query: unknown) {
    requireDashboardView(req.auth, "reports");
    return reportPreviewResponseSchema.parse({ data: this.reports.preview(req.auth, code, query) });
  }
  @Get("report-exports")
  exports(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
    requireDashboardView(req.auth, "reports");
    return reportExportsResponseSchema.parse({ data: this.reports.exports(req.auth, query) });
  }
  @Post("reports/:code/exports")
  requestExport(
    @Req() req: AuthenticatedRequest,
    @Param("code") code: string,
    @Body() body: unknown,
  ) {
    requireDashboardView(req.auth, "reports");
    return this.reports.requestExport(req.auth, code, body);
  }
}
