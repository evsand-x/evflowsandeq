import { z } from "zod";
export const hrisDashboardQuerySchema = z
  .object({
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
    process: z.enum(["all", "contracts", "attendance", "onboarding", "payroll"]).default("all"),
  })
  .strict();
const unavailableState = z
  .object({ value: z.null(), freshness: z.literal("unavailable"), reason: z.string() })
  .strict();
export const hrisDashboardResponseSchema = z
  .object({
    data: z
      .object({
        company_id: z.string().uuid(),
        month: hrisDashboardQuerySchema.shape.month,
        process: hrisDashboardQuerySchema.shape.process,
        timezone: z.literal("Asia/Makassar"),
        definition_version: z.literal("hris-dashboard-v1"),
        data_as_of: z.string().datetime(),
        updated_at: z.string().datetime(),
        freshness: z.literal("unavailable"),
        metrics: z.array(
          unavailableState.extend({
            code: z.enum([
              "active_employees",
              "contracts_review",
              "attendance_corrections",
              "active_onboarding",
            ]),
            unit: z.enum(["people", "contracts", "requests"]),
          }),
        ),
        processes: z
          .object({
            attendance_summary: unavailableState,
            payroll_cutoff: unavailableState,
            payroll_run: unavailableState,
            leave_requests: unavailableState,
            asset_returns: unavailableState,
          })
          .strict(),
        actions: z.array(z.never()),
        total_actions: z.null(),
        actions_status: z.literal("unavailable"),
        actions_reason: z.string(),
      })
      .strict(),
  })
  .strict();
export type HrisDashboardData = z.infer<typeof hrisDashboardResponseSchema>["data"];
