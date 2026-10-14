import { z } from "zod";

export const dashboardDomainSchema = z.enum(["sales", "warehouse", "finance", "hris"]);
export const actionQueueQuerySchema = z
  .object({
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
    tab: z.enum(["approvals", "followups", "completed"]).default("approvals"),
    module: z.enum(["all", "sales", "warehouse", "finance", "hris"]).default("all"),
    search: z.string().trim().max(100).default(""),
    sort: z.enum(["asc", "desc"]).default("asc"),
    cursor: z.string().max(2000).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(5),
  })
  .strict();
export type ActionQueueQuery = z.infer<typeof actionQueueQuerySchema>;
export const actionQueueItemSchema = z
  .object({
    id: z.string().uuid(),
    reference: z.string(),
    title: z.string(),
    module: z.literal("sales"),
    party: z.string(),
    due_at: z.string().datetime(),
    status: z.enum(["overdue", "upcoming"]),
    source: z.literal("prospect_next_action"),
    source_version: z.number().int().positive(),
    destination: z
      .string()
      .regex(/^\/crm\/prospects\/[0-9a-f-]{36}$/)
      .nullable(),
  })
  .strict();
const countSchema = z
  .object({
    value: z.number().int().nonnegative().nullable(),
    unit: z.literal("tasks"),
    freshness: z.enum(["fresh", "unavailable"]),
    reason: z.string(),
  })
  .strict();
export const actionQueueResponseSchema = z
  .object({
    data: z
      .object({
        company_id: z.string().uuid(),
        owner_id: z.string().uuid(),
        month: z.string(),
        timezone: z.literal("Asia/Makassar"),
        definition_version: z.literal("action-queue-v1"),
        data_as_of: z.string().datetime(),
        updated_at: z.string().datetime(),
        freshness: z.enum(["fresh", "unavailable"]),
        coverage: z.string(),
        metrics: z
          .object({ approvals: countSchema, followups: countSchema, overdue: countSchema })
          .strict(),
        items: z.array(actionQueueItemSchema),
        total: z.number().int().nonnegative().nullable(),
        next_cursor: z.string().nullable(),
        status: z.enum(["available", "unavailable"]),
        reason: z.string(),
      })
      .strict(),
  })
  .strict();
export type ActionQueueData = z.infer<typeof actionQueueResponseSchema>["data"];

export const reportCodeSchema = z.enum([
  "ar-aging",
  "net-sales",
  "stock-value",
  "trial-balance",
  "attendance",
]);
export const reportCatalogItemSchema = z
  .object({
    code: reportCodeSchema,
    name: z.string(),
    module: dashboardDomainSchema,
    description: z.string(),
    owner_path: z.string(),
    definition_version: z.string(),
    status: z.literal("unavailable"),
    reason: z.string(),
    destination: z.null(),
    can_export: z.literal(false),
  })
  .strict();
export const reportCatalogResponseSchema = z
  .object({
    data: z
      .object({
        company_id: z.string().uuid(),
        updated_at: z.string().datetime(),
        items: z.array(reportCatalogItemSchema),
      })
      .strict(),
  })
  .strict();
export type ReportCatalogItem = z.infer<typeof reportCatalogItemSchema>;
export const reportParametersSchema = z
  .object({
    as_of: z
      .string()
      .regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, "Tanggal tidak valid."),
    scope: z.literal("authorized").default("authorized"),
    format: z.enum(["xlsx", "csv", "pdf"]).default("xlsx"),
  })
  .strict();
export const reportPreviewResponseSchema = z
  .object({
    data: z
      .object({
        report: reportCatalogItemSchema,
        parameters: reportParametersSchema,
        company_id: z.string().uuid(),
        requested_by: z.string().uuid(),
        updated_at: z.string().datetime(),
        status: z.literal("unavailable"),
        reason: z.string(),
        rows: z.array(z.never()),
      })
      .strict(),
  })
  .strict();
export const reportExportsResponseSchema = z
  .object({
    data: z
      .object({
        company_id: z.string().uuid(),
        requested_by: z.string().uuid(),
        updated_at: z.string().datetime(),
        status: z.literal("unavailable"),
        reason: z.string(),
        items: z.array(z.never()),
        total: z.null(),
        next_cursor: z.null(),
      })
      .strict(),
  })
  .strict();
