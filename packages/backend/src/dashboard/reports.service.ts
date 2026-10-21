import {
  reportCodeSchema,
  reportParametersSchema,
  type AuthPrincipal,
  type ReportCatalogItem,
} from "@evflow/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { hasDomainAccess } from "./workspace-access";

const catalog: (ReportCatalogItem & { permission: string })[] = [
  {
    code: "ar-aging",
    name: "Aging Piutang",
    module: "finance",
    description: "Finance · Piutang per tanggal acuan",
    owner_path: "Finance → Piutang (AR)",
    permission: "finance.read",
    reason: "Sumber piutang dan kebijakan aging belum tersedia.",
  },
  {
    code: "net-sales",
    name: "Penjualan Net",
    module: "sales",
    description: "Sales & Marketing · Invoice diposting",
    owner_path: "Sales & Marketing → Target & Estimasi",
    permission: "crm_prospect.read",
    reason: "Sumber invoice dan retur diposting belum tersedia.",
  },
  {
    code: "stock-value",
    name: "Persediaan & Nilai Stok",
    module: "warehouse",
    description: "Warehouse & Logistik · Posisi stok",
    owner_path: "Warehouse & Logistik → Persediaan",
    permission: "warehouse.read",
    reason: "Sumber stok dan izin nilai persediaan belum tersedia.",
  },
  {
    code: "trial-balance",
    name: "Neraca Saldo",
    module: "finance",
    description: "Finance · Saldo akun periode",
    owner_path: "Finance → Laporan",
    permission: "finance.read",
    reason: "Sumber saldo akun diposting belum tersedia.",
  },
  {
    code: "attendance",
    name: "Kehadiran Karyawan",
    module: "hris",
    description: "HRIS · Rekap sesuai cakupan",
    owner_path: "HRIS → Laporan HRIS",
    permission: "hr.read",
    reason: "Sumber kehadiran dan kebijakan privasi belum tersedia.",
  },
].map((r) => ({
  ...r,
  definition_version: "report-catalog-v1",
  status: "unavailable",
  destination: null,
  can_export: false,
})) as (ReportCatalogItem & { permission: string })[];

@Injectable()
export class ReportsService {
  catalog(principal: AuthPrincipal, raw: unknown = {}) {
    if (!z.object({}).strict().safeParse(raw).success)
      throw new BadRequestException("Filter katalog tidak valid.");
    return {
      company_id: principal.company_id,
      updated_at: new Date().toISOString(),
      items: catalog
        .filter((r) => hasDomainAccess(principal, r.permission))
        .map(({ permission: _permission, ...r }) => r),
    };
  }
  private report(principal: AuthPrincipal, code: string) {
    if (!reportCodeSchema.safeParse(code).success)
      throw new NotFoundException("Laporan tidak ditemukan.");
    const entry = catalog.find((r) => r.code === code)!;
    if (!hasDomainAccess(principal, entry.permission))
      throw new ForbiddenException("Izin atau scope laporan tidak mencukupi.");
    const report = this.catalog(principal).items.find((r) => r.code === entry.code)!;
    return report;
  }
  preview(principal: AuthPrincipal, code: string, raw: unknown) {
    const report = this.report(principal, code);
    const parsed = reportParametersSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Parameter laporan tidak valid.");
    return {
      company_id: principal.company_id,
      requested_by: principal.user_id,
      report,
      parameters: parsed.data,
      status: "unavailable" as const,
      reason: report.reason,
      updated_at: new Date().toISOString(),
      rows: [],
    };
  }
  exports(principal: AuthPrincipal, raw: unknown = {}) {
    if (!z.object({}).strict().safeParse(raw).success)
      throw new BadRequestException("Filter ekspor tidak valid.");
    return {
      company_id: principal.company_id,
      requested_by: principal.user_id,
      updated_at: new Date().toISOString(),
      status: "unavailable" as const,
      reason: "Riwayat file ekspor belum tersedia.",
      items: [],
      total: null,
      next_cursor: null,
    };
  }
  requestExport(principal: AuthPrincipal, code: string, raw: unknown): never {
    this.preview(principal, code, raw);
    // No job, file or grant may be created until source, export permission and policy are implemented.
    throw new ConflictException(
      "Ekspor belum tersedia. Tidak ada pekerjaan atau file yang dibuat.",
    );
  }
}
