import { z } from "zod";

export const financeDashboardQuerySchema = z
  .object({
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
    process: z.enum(["all", "receivables", "matching", "allocation", "closing"]).default("all"),
  })
  .strict();
const unavailableState = z.object({
  value: z.null(),
  freshness: z.literal("unavailable"),
  reason: z.string(),
});
export const financeDashboardResponseSchema = z.object({
  data: z.object({
    company_id: z.string().uuid(),
    month: financeDashboardQuerySchema.shape.month,
    process: financeDashboardQuerySchema.shape.process,
    timezone: z.literal("Asia/Makassar"),
    currency: z.literal("IDR"),
    definition_version: z.literal("finance-dashboard-v1"),
    data_as_of: z.string().datetime(),
    updated_at: z.string().datetime(),
    freshness: z.literal("unavailable"),
    metrics: z.array(
      unavailableState.extend({
        code: z.enum([
          "open_receivables",
          "open_payables",
          "allocated_receipts",
          "posted_payments",
        ]),
        unit: z.literal("IDR"),
      }),
    ),
    closing: z.object({
      period_status: unavailableState,
      completed_steps: unavailableState,
      bank_reconciliation: unavailableState,
      inventory_reconciliation: unavailableState,
    }),
    actions: z.array(z.never()),
    total_actions: z.null(),
    actions_status: z.literal("unavailable"),
    actions_reason: z.string(),
  }),
});
export type FinanceDashboardData = z.infer<typeof financeDashboardResponseSchema>["data"];
