ALTER TYPE "LedgerEntryKind" ADD VALUE IF NOT EXISTS 'SALE_FREIGHT_REVENUE';

ALTER TABLE "sales_orders"
  ADD COLUMN "freight_terms_snapshot" JSONB,
  ADD COLUMN "freight_estimate" DECIMAL(24,8);

ALTER TABLE "fulfillment_batches"
  ADD COLUMN "freight_amount" DECIMAL(24,8) NOT NULL DEFAULT 0,
  ADD COLUMN "freight_tax_amount" DECIMAL(24,8) NOT NULL DEFAULT 0,
  ADD COLUMN "freight_tax_snapshot" JSONB,
  ADD COLUMN "freight_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "sales_invoices"
  ADD COLUMN "freight_amount" DECIMAL(24,8) NOT NULL DEFAULT 0,
  ADD COLUMN "freight_tax_amount" DECIMAL(24,8) NOT NULL DEFAULT 0,
  ADD COLUMN "freight_snapshot" JSONB;

ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_freight_estimate_nonnegative"
  CHECK ("freight_estimate" IS NULL OR "freight_estimate" >= 0);
ALTER TABLE "fulfillment_batches" ADD CONSTRAINT "fulfillment_batches_freight_nonnegative"
  CHECK ("freight_amount" >= 0 AND "freight_tax_amount" >= 0);
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_freight_nonnegative"
  CHECK ("freight_amount" >= 0 AND "freight_tax_amount" >= 0);
