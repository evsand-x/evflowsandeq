import {
  financeDashboardQuerySchema,
  type AuthPrincipal,
  type FinanceDashboardData,
} from "@evflow/contracts";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class FinanceDashboardService {
  read(principal: AuthPrincipal, rawQuery: unknown): FinanceDashboardData {
    if (
      !principal.permissions.some(
        (p) =>
          p.code === "finance.read" &&
          ["company", "privileged"].includes(p.scope_type) &&
          (!p.scope_id || p.scope_id === principal.company_id),
      )
    )
      throw new ForbiddenException("Izin atau scope tidak mencukupi.");
    const parsed = financeDashboardQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Filter Dashboard Finance tidak valid.");
    const now = new Date().toISOString();
    const unavailable = (reason: string) =>
      ({ value: null, freshness: "unavailable", reason }) as const;
    const metric = (code: FinanceDashboardData["metrics"][number]["code"], reason: string) =>
      ({ code, unit: "IDR", ...unavailable(reason) }) as const;
    return {
      company_id: principal.company_id,
      ...parsed.data,
      timezone: "Asia/Makassar",
      currency: "IDR",
      definition_version: "finance-dashboard-v1",
      data_as_of: now,
      updated_at: now,
      freshness: "unavailable",
      metrics: [
        metric("open_receivables", "Data piutang diposting belum tersedia."),
        metric("open_payables", "Data utang supplier/vendor belum tersedia."),
        metric("allocated_receipts", "Data penerimaan diposting dan dialokasikan belum tersedia."),
        metric("posted_payments", "Data pembayaran diposting belum tersedia."),
      ],
      closing: {
        period_status: unavailable("Status periode akuntansi belum tersedia."),
        completed_steps: unavailable("Checklist dan hasil closing belum tersedia."),
        bank_reconciliation: unavailable("Data rekonsiliasi bank belum tersedia."),
        inventory_reconciliation: unavailable("Data rekonsiliasi persediaan belum tersedia."),
      },
      actions: [],
      total_actions: null,
      actions_status: "unavailable",
      actions_reason:
        "Antrean piutang, pencocokan tagihan, alokasi dana, dan closing belum tersedia.",
    };
  }
}
