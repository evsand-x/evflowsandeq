import { z } from "zod";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  );
const positive = z
  .string()
  .regex(/^\d{1,16}(\.\d{1,8})?$/)
  .refine((v) => /[1-9]/.test(v), "Must be positive");
export const invoicePaymentDeductionSchema = z
  .object({
    source_type: z.enum(["TAX", "DEDUCTION_TYPE"]),
    source_id: z.string().uuid(),
    mode: z.enum(["AMOUNT", "PERCENT"]),
    value: positive,
    evidence_id: z.string().uuid().optional(),
    proof_number: z.string().trim().min(1).max(200).optional(),
    proof_date: date.optional(),
  })
  .strict()
  .refine(
    (v) => !v.evidence_id || (!!v.proof_number && !!v.proof_date),
    "Proof number and date required",
  );
export const receiveInvoicePaymentSchema = z
  .object({
    received_date: date,
    bank_account_id: z.string().uuid(),
    amount: positive,
    bank_reference: z.string().trim().min(1).max(200),
    external_reference: z.string().trim().max(200).optional(),
    evidence_id: z.string().uuid(),
    deductions: z.array(invoicePaymentDeductionSchema).max(50).default([]),
  })
  .strict();
export const completeInvoicePaymentDeductionProofSchema = z
  .object({
    evidence_id: z.string().uuid(),
    proof_number: z.string().trim().min(1).max(200),
    proof_date: date,
    settlement_date: date,
  })
  .strict();
export type ReceiveInvoicePaymentInput = z.input<typeof receiveInvoicePaymentSchema>;
export type CompleteInvoicePaymentDeductionProofInput = z.input<
  typeof completeInvoicePaymentDeductionProofSchema
>;
