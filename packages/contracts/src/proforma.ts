import { z } from "zod";

export const issueProformaSchema = z
  .object({ version: z.string().regex(/^[a-f0-9]{64}$/) })
  .extend({
    freight: z
      .object({
        amount: z.string().regex(/^\d{1,14}(\.\d{1,8})?$/),
        tax_mode: z.enum(["NON_TAXABLE", "TAXABLE"]),
        tax_rule_id: z.string().uuid().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const previewProformaSchema = issueProformaSchema.pick({ freight: true });
export type ProformaPreview = {
  version: string;
  snapshot: {
    order_number: string;
    batch_number: string;
    customer: string;
    address: string | null;
    currency: string;
    subtotal: string;
    tax: string;
    total: string;
    freight: { amount: string; tax: string; tax_snapshot: unknown };
    allocations: {
      allocation_id: string;
      product: string;
      unit: string;
      quantity: string;
      unit_price: string;
      amounts: { net: string; tax: string; total: string };
    }[];
  };
  existing: { id: string; number: string } | null;
  supersedes: { id: string; number: string } | null;
};
