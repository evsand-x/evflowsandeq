ALTER TABLE "customer_receipts" ADD COLUMN "number" TEXT, ADD COLUMN "invoice_payment" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "customer_receipts_company_id_number_key" ON "customer_receipts" ("company_id", "number");
CREATE UNIQUE INDEX "invoice_payment_bank_reference_key" ON "customer_receipts" ("company_id", "bank_account_id", "bank_reference") WHERE "invoice_payment" = true;
CREATE TABLE "invoice_payment_deductions" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL REFERENCES "companies"("id"),
 "invoice_id" UUID NOT NULL REFERENCES "sales_invoices"("id"), "receipt_id" UUID NOT NULL REFERENCES "customer_receipts"("id"),
 "source_type" TEXT NOT NULL, "source_id" UUID NOT NULL, "mode" TEXT NOT NULL,
 "value" NUMERIC(24,8) NOT NULL, "base_amount" NUMERIC(24,8) NOT NULL, "amount" NUMERIC(24,8) NOT NULL CHECK ("amount" > 0),
 "account_id" UUID NOT NULL REFERENCES "finance_accounts"("id"), "snapshot" JSONB NOT NULL,
 "state" TEXT NOT NULL CHECK ("state" IN ('PENDING_PROOF','SETTLED')),
 "evidence_id" UUID REFERENCES "transaction_evidence"("id"), "proof_number" TEXT, "proof_date" DATE,
 "settled_at" TIMESTAMPTZ(6), "created_by_id" UUID NOT NULL REFERENCES "users"("id"), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "invoice_payment_deductions_company_id_invoice_id_state_idx" ON "invoice_payment_deductions" ("company_id","invoice_id","state");
CREATE INDEX "invoice_payment_deductions_receipt_id_idx" ON "invoice_payment_deductions" ("receipt_id");
