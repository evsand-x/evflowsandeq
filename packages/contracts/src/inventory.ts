import { z } from "zod";

const decimal = z.string().regex(/^\d+(\.\d+)?$/);
export const inventoryListQuerySchema = z
  .object({
    search: z.string().max(150).default(""),
    warehouse_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    low_only: z.coerce.boolean().default(false),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const stockCardQuerySchema = z
  .object({
    warehouse_id: z.string().uuid().optional(),
    batch_no: z.string().max(100).optional(),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .strict()
  .refine((x) => x.to >= x.from, { message: "Rentang tanggal tidak valid." });
export const createStockCountSchema = z
  .object({
    warehouse_id: z.string().uuid(),
    locator_ids: z.array(z.string().uuid()).min(1),
    reason: z.string().trim().min(3).max(1000),
    lines: z
      .array(z.object({ stock_lot_id: z.string().uuid(), counted_quantity: decimal }).strict())
      .min(1)
      .max(1000),
    version: z.number().int().positive().optional(),
  })
  .strict();
export const updateStockCountSchema = z
  .object({
    version: z.number().int().positive(),
    lines: z
      .array(z.object({ stock_lot_id: z.string().uuid(), counted_quantity: decimal }).strict())
      .min(1)
      .max(1000),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export const stockCountVersionSchema = z.object({ version: z.number().int().positive() }).strict();
export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;
export type StockCardQuery = z.infer<typeof stockCardQuerySchema>;
export type CreateStockCount = z.infer<typeof createStockCountSchema>;
