import {
  isAccessAdministrator,
  hrisDashboardQuerySchema,
  type AuthPrincipal,
  type HrisDashboardData,
} from "@evflow/contracts";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
@Injectable()
export class HrisDashboardService {
  read(principal: AuthPrincipal, rawQuery: unknown): HrisDashboardData {
    if (
      !isAccessAdministrator(principal) && !principal.permissions.some(
        (p) =>
          p.code === "hr.read" &&
          ["company", "privileged"].includes(p.scope_type) &&
          (!p.scope_id || p.scope_id === principal.company_id),
      )
    )
      throw new ForbiddenException("Izin atau scope tidak mencukupi.");
    const parsed = hrisDashboardQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Filter Dashboard HRIS tidak valid.");
    const now = new Date().toISOString();
    const unavailable = (reason: string) =>
      ({ value: null, freshness: "unavailable", reason }) as const;
    const metric = (
      code: HrisDashboardData["metrics"][number]["code"],
      unit: HrisDashboardData["metrics"][number]["unit"],
      reason: string,
    ) => ({ code, unit, ...unavailable(reason) });
    return {
      company_id: principal.company_id,
      ...parsed.data,
      timezone: "Asia/Makassar",
      definition_version: "hris-dashboard-v1",
      data_as_of: now,
      updated_at: now,
      freshness: "unavailable",
      metrics: [
        metric("active_employees", "people", "Data karyawan aktif belum tersedia."),
        metric(
          "contracts_review",
          "contracts",
          "Data kontrak dan kebijakan pengingat belum tersedia.",
        ),
        metric("attendance_corrections", "requests", "Data koreksi absensi belum tersedia."),
        metric("active_onboarding", "people", "Data onboarding belum tersedia."),
      ],
      processes: {
        attendance_summary: unavailable("Rekap absensi belum tersedia."),
        payroll_cutoff: unavailable("Status cut-off payroll belum tersedia."),
        payroll_run: unavailable("Status proses payroll belum tersedia."),
        leave_requests: unavailable("Data permintaan cuti belum tersedia."),
        asset_returns: unavailable("Data pengembalian aset belum tersedia."),
      },
      actions: [],
      total_actions: null,
      actions_status: "unavailable",
      actions_reason: "Tindak lanjut kontrak, absensi, onboarding, dan payroll belum tersedia.",
    };
  }
}
