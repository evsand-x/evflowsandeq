import { z } from "zod";

const positiveDecimal = z
  .string()
  .regex(/^\d{1,14}(\.\d{1,10})?$/)
  .refine((v) => !/^0+(\.0*)?$/.test(v));
const nonNegativeDecimal = z.string().regex(/^\d{1,14}(\.\d{1,10})?$/);
const freightTermsSchema = z
  .object({
    payer: z.enum(["CUSTOMER", "COMPANY", "CARRIER"]),
    basis: z.literal("PER_SHIPMENT"),
    estimate: nonNegativeDecimal,
    tax_mode: z.enum(["NON_TAXABLE", "TAXABLE"]),
    /** Refused (FREIGHT_TAX_RULE_NOT_ALLOWED): taxable freight always uses the default sales tax. */
    tax_rule_id: z.string().uuid().optional(),
  })
  .strict();
export const openingStockSchema = z
  .object({
    product_id: z.string().uuid(),
    warehouse_id: z.string().uuid(),
    locator_id: z.string().uuid(),
    batch_no: z.string().trim().min(1).max(100),
    expiry_date: z.string().date().nullable().optional(),
    quantity: positiveDecimal,
    unit_cost: z.string().regex(/^\d{1,16}(\.\d{1,8})?$/),
  })
  .strict();
export const salesOrderDisplayStatusSchema = z.enum([
  "DRAFT",
  "WAITING_APPROVAL",
  "OPEN",
  "PARTIALLY_SHIPPED",
  "IN_DELIVERY",
  "COMPLETED",
  "CANCELLED",
]);
export type SalesOrderDisplayStatus = z.infer<typeof salesOrderDisplayStatusSchema>;

export const salesOrderNumberSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9][A-Za-z0-9./_-]*$/, "Nomor SO hanya huruf, angka, titik, garis miring, garis bawah dan tanda hubung.");
export const createSalesOrderSchema = z
  .object({
    customer_id: z.string().uuid(),
    /** Optional user-edited SO number; omitted means the next number from Setting › Penomoran Dokumen. */
    number: salesOrderNumberSchema.optional(),
    customer_reference: z.string().trim().max(100).optional(),
    delivery_address: z.string().trim().max(1000).optional(),
    evidence_id: z.string().uuid().optional(),
    order_date: z.string().date().optional(),
    payment_term_code: z.string().trim().min(1).max(40).optional(),
    salesperson_id: z.string().uuid().optional(),
    warehouse_id: z.string().uuid().optional(),
    notes: z.string().trim().max(2000).optional(),
    freight: freightTermsSchema.optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("IDR"),
    lines: z
      .array(
        z
          .object({
            product_id: z.string().uuid(),
            warehouse_id: z.string().uuid().optional(),
            quantity: positiveDecimal,
            unit_price: z.string().regex(/^\d{1,16}(\.\d{1,8})?$/),
            /** Refused (LINE_TAX_NOT_ALLOWED): every line uses the default sales tax. */
            tax_master_id: z.string().uuid().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const shipmentSchema = z
  .object({
    driver: z.string().trim().min(1).max(200),
    vehicle: z.string().trim().min(1).max(100),
    planned_at: z.string().datetime(),
    freight: z
      .object({
        amount: nonNegativeDecimal,
        tax_mode: z.enum(["NON_TAXABLE", "TAXABLE"]),
        /** Refused (FREIGHT_TAX_RULE_NOT_ALLOWED): taxable freight always uses the default sales tax. */
        tax_rule_id: z.string().uuid().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const idempotencySchema = z.string().trim().min(8).max(200);
export const confirmPodSchema = z
  .object({
    receiver_name: z.string().trim().min(1).max(200),
    evidence_id: z.string().uuid(),
    quarantine_locator_id: z.string().uuid().optional(),
    accepted_at: z.string().datetime().optional(),
    lines: z
      .array(
        z
          .object({
            fulfillment_allocation_id: z.string().uuid(),
            accepted_quantity: nonNegativeDecimal,
            returned_quantity: nonNegativeDecimal.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const postInvoiceSchema = z.object({ delivery_receipt_id: z.string().uuid() }).strict();

/** Release 1 Surat Jalan draft: quantities are validated cumulatively against the SO on the server. */
export const createSuratJalanSchema = z
  .object({
    sales_order_id: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            sales_order_line_id: z.string().uuid(),
            quantity: positiveDecimal,
            warehouse_id: z.string().uuid().optional(),
            locator_id: z.string().uuid().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.lines.map((line) => line.sales_order_line_id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "Baris Surat Jalan tidak boleh duplikat." });
    }
  });

/** Release 1 issue event: Surat Jalan is the handover, stock, revenue and HPP event. */
export const issueSuratJalanSchema = z
  .object({
    handover_at: z.string().datetime(),
    receiver_name: z.string().trim().min(1).max(200),
    // Release 1 handover evidence is required to issue Surat Jalan.
    evidence_id: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            sales_order_line_id: z.string().uuid(),
            delivered_quantity: positiveDecimal,
            rejected_quantity: nonNegativeDecimal.optional(),
            discrepancy_reason: z.string().trim().max(1000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.lines.map((line) => line.sales_order_line_id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "Baris Surat Jalan tidak boleh duplikat." });
    }
  });

/** Invoice source contract: one posted invoice at most per issued Surat Jalan. */
export const createInvoiceFromSuratJalanSchema = z
  .object({ surat_jalan_id: z.string().uuid() })
  .strict();

export type CreateSuratJalanInput = z.infer<typeof createSuratJalanSchema>;
export type IssueSuratJalanInput = z.infer<typeof issueSuratJalanSchema>;
export type CreateInvoiceFromSuratJalanInput = z.infer<typeof createInvoiceFromSuratJalanSchema>;

// Public command aliases use the English aggregate name used by the API while
// retaining the Indonesian document name in the Office UI.
export const createDeliveryNoteSchema = createSuratJalanSchema;
export const issueDeliveryNoteSchema = issueSuratJalanSchema;
export const createInvoiceFromDeliveryNoteSchema = createInvoiceFromSuratJalanSchema;
export type CreateDeliveryNoteInput = CreateSuratJalanInput;
export type IssueDeliveryNoteInput = IssueSuratJalanInput;
export type CreateInvoiceFromDeliveryNoteInput = CreateInvoiceFromSuratJalanInput;
export const invoiceDraftSchema = z
  .object({
    delivery_receipt_id: z.string().uuid(),
    notes: z.string().trim().max(2000).default(""),
    billing_reference: z.string().trim().max(200).default(""),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type OpeningStockInput = z.infer<typeof openingStockSchema>;
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export const approvePurchaseRequestSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
export const createPurchaseOrderSchema = z
  .object({
    supplier_id: z.string().uuid(),
    warehouse_id: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            purchase_request_line_id: z.string().uuid(),
            quantity: positiveDecimal,
            unit_cost: z.string().regex(/^\d{1,16}(\.\d{1,8})?$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const receivePurchaseOrderSchema = z
  .object({
    locator_id: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            purchase_order_line_id: z.string().uuid(),
            quantity: positiveDecimal,
            batch_no: z.string().trim().min(1).max(100),
            expiry_date: z.string().date().nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const createSupplierInvoiceSchema = z
  .object({
    supplier_invoice_number: z.string().trim().min(1).max(100),
    invoice_date: z.string().date(),
    due_date: z.string().date(),
    tax_amount: nonNegativeDecimal.optional(),
    tax_master_id: z.string().uuid().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("IDR"),
    lines: z
      .array(
        z
          .object({
            purchase_order_line_id: z.string().uuid(),
            quantity: positiveDecimal,
            unit_cost: z.string().regex(/^\d{1,16}(\.\d{1,8})?$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const postSupplierInvoiceSchema = z
  .object({ supplier_invoice_id: z.string().uuid() })
  .strict();
export const createCustomerReceiptSchema = z
  .object({
    bank_account_id: z.string().uuid(),
    evidence_id: z.string().uuid(),
    bank_reference: z.string().trim().min(1).max(200),
    amount: positiveDecimal,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("IDR"),
    received_at: z.string().datetime().optional(),
    fulfillment_batch_id: z.string().uuid().optional(),
    external_reference: z.string().trim().max(100).optional(),
  })
  .strict();
export const allocateCustomerReceiptSchema = z
  .object({ invoice_id: z.string().uuid(), amount: positiveDecimal })
  .strict();
export const createCustomerReturnSchema = z
  .object({
    sales_invoice_id: z.string().uuid().optional(),
    reason: z.string().trim().min(1).max(500),
    lines: z
      .array(
        z
          .object({
            delivery_receipt_line_id: z.string().uuid(),
            quantity: positiveDecimal,
            quarantine_locator_id: z.string().uuid(),
            batch_no: z.string().trim().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const postCreditNoteSchema = z.object({ customer_return_id: z.string().uuid() }).strict();
export const postCustomerRefundSchema = z
  .object({
    credit_note_id: z.string().uuid(),
    amount: positiveDecimal,
    approval_request_id: z.string().uuid(),
    bank_account_id: z.string().uuid(),
    evidence_id: z.string().uuid(),
    bank_reference: z.string().trim().min(1).max(200),
  })
  .strict();
export const pickListConfirmSchema = z
  .object({
    version: z.number().int().positive().optional(),
    reason: z.string().trim().max(1000).optional(),
    lines: z
      .array(
        z
          .object({ pick_list_line_id: z.string().uuid(), picked_quantity: nonNegativeDecimal })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const pickListCheckSchema = z
  .object({
    packing: z
      .object({
        package_count: z
          .string()
          .regex(/^\d{1,6}$/)
          .optional(),
        total_weight_kg: nonNegativeDecimal.optional(),
        package_type: z.string().trim().max(100).optional(),
        notes: z.string().trim().max(2000).optional(),
        label_attached: z.boolean().optional(),
      })
      .strict()
      .optional(),
    checks: z
      .array(
        z
          .object({
            pick_list_line_id: z.string().uuid(),
            condition: z.string().trim().min(1).max(100),
            checked_quantity: nonNegativeDecimal.optional(),
            notes: z.string().trim().max(500).optional(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict();

export const recordSalesOrderAdvanceSchema = z.object({
 amount: z.string().regex(/^\d{1,16}(\.\d{1,8})?$/).refine(v => !/^0+(\.0*)?$/.test(v)),
 received_at: z.string().datetime(),
 bank_account_id: z.string().uuid(),
 bank_reference: z.string().trim().min(1).max(200).optional(),
 evidence_id: z.string().uuid(),
}).strict();
export const verifySalesOrderAdvanceSchema = z.object({ version: z.number().int().positive() }).strict();
export const rejectSalesOrderAdvanceSchema = verifySalesOrderAdvanceSchema.extend({ reason: z.string().trim().min(1).max(500) });
