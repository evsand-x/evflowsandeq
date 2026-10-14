-- Customer receipts, prepayment gate and AR allocation.
ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'CASH_RECEIPT';
ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'CUSTOMER_ADVANCE';
CREATE TYPE "public"."CustomerReceiptState" AS ENUM ('POSTED', 'REVERSED');
ALTER TABLE "public"."sales_invoices" ADD COLUMN "outstanding_amount" DECIMAL(24,8) NOT NULL DEFAULT 0;
UPDATE "public"."sales_invoices" SET "outstanding_amount" = "subtotal" WHERE "outstanding_amount" = 0;

CREATE TABLE "public"."customer_receipts" (
 "id" UUID NOT NULL,
 "company_id" UUID NOT NULL,
 "customer_id" UUID NOT NULL,
 "fulfillment_batch_id" UUID,
 "external_reference" TEXT,
 "received_at" TIMESTAMPTZ(6) NOT NULL,
 "amount" DECIMAL(24,8) NOT NULL,
 "unallocated_amount" DECIMAL(24,8) NOT NULL,
 "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
 "state" "public"."CustomerReceiptState" NOT NULL DEFAULT 'POSTED',
 "idempotency_key" TEXT NOT NULL,
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "created_by_id" UUID NOT NULL,
 CONSTRAINT "customer_receipts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_receipts_company_idempotency_key_key" ON "public"."customer_receipts"("company_id", "idempotency_key");
CREATE INDEX "customer_receipts_company_customer_state_received_idx" ON "public"."customer_receipts"("company_id", "customer_id", "state", "received_at");

CREATE TABLE "public"."customer_receipt_allocations" (
 "id" UUID NOT NULL,
 "company_id" UUID NOT NULL,
 "receipt_id" UUID NOT NULL,
 "invoice_id" UUID NOT NULL,
 "amount" DECIMAL(24,8) NOT NULL,
 CONSTRAINT "customer_receipt_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_receipt_allocations_receipt_invoice_key" ON "public"."customer_receipt_allocations"("receipt_id", "invoice_id");
CREATE INDEX "customer_receipt_allocations_company_invoice_idx" ON "public"."customer_receipt_allocations"("company_id", "invoice_id");
ALTER TABLE "public"."customer_receipts" ADD CONSTRAINT "customer_receipts_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."customer_receipts" ADD CONSTRAINT "customer_receipts_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."customer_receipts" ADD CONSTRAINT "customer_receipts_batch_fkey" FOREIGN KEY ("fulfillment_batch_id") REFERENCES "public"."fulfillment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."customer_receipt_allocations" ADD CONSTRAINT "customer_receipt_allocations_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."customer_receipt_allocations" ADD CONSTRAINT "customer_receipt_allocations_receipt_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."customer_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."customer_receipt_allocations" ADD CONSTRAINT "customer_receipt_allocations_invoice_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
