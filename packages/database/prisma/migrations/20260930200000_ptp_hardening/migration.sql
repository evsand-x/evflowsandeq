-- Harden PR coverage, PO partial receipt, GR idempotency and balanced GRNI posting.
ALTER TYPE "public"."PurchaseOrderState" ADD VALUE 'PARTIALLY_RECEIVED';
ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'GRNI';

ALTER TABLE "public"."purchase_request_lines"
  ADD COLUMN "covered_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0,
  ADD COLUMN "fulfilled_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0;

ALTER TABLE "public"."goods_receipts"
  ADD COLUMN "idempotency_key" TEXT;
UPDATE "public"."goods_receipts" SET "idempotency_key" = "id"::text WHERE "idempotency_key" IS NULL;
ALTER TABLE "public"."goods_receipts" ALTER COLUMN "idempotency_key" SET NOT NULL;
CREATE UNIQUE INDEX "goods_receipts_company_idempotency_key_key"
  ON "public"."goods_receipts"("company_id", "idempotency_key");

CREATE TABLE "public"."purchase_order_request_allocations" (
  "id" UUID NOT NULL,
  "purchase_order_line_id" UUID NOT NULL,
  "purchase_request_line_id" UUID NOT NULL,
  "quantity" DECIMAL(24,10) NOT NULL,
  CONSTRAINT "purchase_order_request_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "purchase_order_request_allocations_po_line_pr_line_key"
  ON "public"."purchase_order_request_allocations"("purchase_order_line_id", "purchase_request_line_id");
CREATE INDEX "purchase_order_request_allocations_pr_line_idx"
  ON "public"."purchase_order_request_allocations"("purchase_request_line_id");
ALTER TABLE "public"."purchase_order_request_allocations"
  ADD CONSTRAINT "purchase_order_request_allocations_po_line_fkey"
  FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."purchase_order_request_allocations"
  ADD CONSTRAINT "purchase_order_request_allocations_pr_line_fkey"
  FOREIGN KEY ("purchase_request_line_id") REFERENCES "public"."purchase_request_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
