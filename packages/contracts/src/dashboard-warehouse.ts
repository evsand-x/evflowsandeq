import { z } from "zod";

export const warehouseDashboardQuerySchema = z
  .object({
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
    warehouse_id: z.string().uuid().optional(),
    stage: z.enum(["all", "inbound", "picking", "shipping", "quality"]).default("all"),
  })
  .strict();

export const warehouseDashboardResponseSchema = z.object({
  data: z.object({
    company_id: z.string().uuid(),
    month: z.string(),
    warehouse_id: z.string().uuid().nullable(),
    stage: warehouseDashboardQuerySchema.shape.stage,
    timezone: z.literal("Asia/Makassar"),
    definition_version: z.literal("warehouse-dashboard-v1"),
    data_as_of: z.string().datetime(),
    updated_at: z.string().datetime(),
    freshness: z.literal("unavailable"),
    warehouses: z.array(z.object({ id: z.string().uuid(), code: z.string(), name: z.string() })),
    metrics: z.array(
      z.object({
        code: z.enum([
          "pending_receipts",
          "picking_tasks",
          "active_shipments",
          "quarantine_batches",
          "below_minimum",
          "backorders",
          "near_expiry",
        ]),
        unit: z.enum(["shipments", "tasks", "batches", "products", "orders"]),
        value: z.null(),
        freshness: z.literal("unavailable"),
        reason: z.string(),
      }),
    ),
    actions: z.array(z.never()),
    total_actions: z.null(),
    actions_status: z.literal("unavailable"),
    actions_reason: z.string(),
  }),
});
export type WarehouseDashboardQuery = z.infer<typeof warehouseDashboardQuerySchema>;
export type WarehouseDashboardData = z.infer<typeof warehouseDashboardResponseSchema>["data"];
