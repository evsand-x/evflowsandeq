import {
  isAccessAdministrator,
  warehouseDashboardQuerySchema,
  type AuthPrincipal,
  type WarehouseDashboardData,
} from "@evflow/contracts";
import { prisma } from "@evflow/database";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class WarehouseDashboardService {
  async read(principal: AuthPrincipal, rawQuery: unknown): Promise<WarehouseDashboardData> {
    const grants = principal.permissions.filter((p) => p.code === "warehouse.read");
    const companyWide = isAccessAdministrator(principal) || grants.some(
      (p) =>
        ["company", "privileged"].includes(p.scope_type) &&
        (!p.scope_id || p.scope_id === principal.company_id),
    );
    const warehouseIds = grants
      .filter((p) => p.scope_type === "warehouse" && p.scope_id)
      .map((p) => p.scope_id!);
    if (!companyWide && !warehouseIds.length)
      throw new ForbiddenException("Izin atau scope tidak mencukupi.");
    const parsed = warehouseDashboardQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Filter Dashboard Warehouse tidak valid.");
    const query = parsed.data;
    const warehouses = await prisma.warehouse.findMany({
      where: {
        companyId: principal.company_id,
        state: "ACTIVE",
        ...(!companyWide ? { id: { in: warehouseIds } } : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    if (
      (!companyWide && !warehouses.length) ||
      (query.warehouse_id && !warehouses.some((w) => w.id === query.warehouse_id))
    ) {
      throw new ForbiddenException("Izin atau scope tidak mencukupi.");
    }
    const now = new Date().toISOString();
    const unavailable = (
      code: WarehouseDashboardData["metrics"][number]["code"],
      unit: WarehouseDashboardData["metrics"][number]["unit"],
      reason: string,
    ) => ({ code, unit, value: null, freshness: "unavailable", reason }) as const;
    return {
      company_id: principal.company_id,
      month: query.month,
      warehouse_id: query.warehouse_id ?? null,
      stage: query.stage,
      timezone: "Asia/Makassar",
      definition_version: "warehouse-dashboard-v1",
      data_as_of: now,
      updated_at: now,
      freshness: "unavailable",
      warehouses,
      metrics: [
        unavailable(
          "pending_receipts",
          "shipments",
          "Data penerimaan dan pemeriksaan belum tersedia.",
        ),
        unavailable("picking_tasks", "tasks", "Data alokasi dan tugas picking belum tersedia."),
        unavailable("active_shipments", "shipments", "Data pengiriman dan POD belum tersedia."),
        unavailable(
          "quarantine_batches",
          "batches",
          "Data batch dan status kualitas belum tersedia.",
        ),
        unavailable(
          "below_minimum",
          "products",
          "Data saldo stok dan batas minimum belum tersedia.",
        ),
        unavailable("backorders", "orders", "Data sisa pesanan belum tersedia."),
        unavailable("near_expiry", "batches", "Data batch dan kebijakan expiry belum tersedia."),
      ],
      actions: [],
      total_actions: null,
      actions_status: "unavailable",
      actions_reason: "Antrean penerimaan, picking, pengiriman, dan inspeksi belum tersedia.",
    };
  }
}
