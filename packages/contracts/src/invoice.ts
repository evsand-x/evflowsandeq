import { z } from "zod";

export const salesInvoiceNumberSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9./_-]*$/,
    "Nomor Invoice hanya huruf, angka, titik, garis miring, garis bawah dan tanda hubung.",
  );
export const salesInvoiceDraftSchema = z
  .object({
    surat_jalan_id: z.string().uuid(),
    number: salesInvoiceNumberSchema.optional(),
    invoice_date: z.string().date().optional(),
    notes: z.string().trim().max(2000).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();
export const submitSalesInvoiceSchema = z.object({ version: z.number().int().positive() }).strict();
export const salesInvoiceListSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    search: z.string().trim().max(150).default(""),
    customer_id: z.string().uuid().optional(),
    tab: z.enum(["ALL", "DRAFT", "UNPAID", "PARTIAL", "OVERDUE", "PAID"]).default("ALL"),
  })
  .strict();
export type SalesInvoiceDraftInput = z.infer<typeof salesInvoiceDraftSchema>;
