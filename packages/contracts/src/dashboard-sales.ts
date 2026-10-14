import { z } from "zod";

export const salesDashboardQuerySchema = z
  .object({
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
    status: z.enum(["all", "overdue", "upcoming"]).default("all"),
    sort: z.enum(["asc", "desc"]).default("asc"),
    cursor: z.string().max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(4),
  })
  .strict();
export type SalesDashboardQuery = z.infer<typeof salesDashboardQuerySchema>;

export const salesActionSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  action: z.string(),
  customer_name: z.string(),
  due_at: z.string().datetime(),
  status: z.enum(["overdue", "upcoming"]),
});
export type SalesDashboardAction = z.infer<typeof salesActionSchema>;

const unavailableMetric = z.object({
  code: z.enum([
    "net_sales",
    "sales_achievement",
    "successful_visits",
    "new_customers",
    "target",
    "estimate",
    "estimate_achievement",
  ]),
  value: z.null(),
  unit: z.enum(["IDR", "percent", "sessions", "customers"]),
  freshness: z.literal("unavailable"),
  reason: z.string(),
});
export const salesDashboardResponseSchema = z.object({
  data: z.object({
    company_id: z.string().uuid(),
    owner_id: z.string().uuid(),
    month: z.string(),
    timezone: z.literal("Asia/Makassar"),
    definition_version: z.literal("sales-dashboard-v1"),
    data_as_of: z.string().datetime(),
    updated_at: z.string().datetime(),
    freshness: z.literal("fresh"),
    metrics: z.array(unavailableMetric),
    actions: z.array(salesActionSchema),
    total_actions: z.number().int().nonnegative(),
    next_cursor: z.string().nullable(),
    source: z.literal("prospect_next_action"),
  }),
});
export type SalesDashboardData = z.infer<typeof salesDashboardResponseSchema>["data"];
