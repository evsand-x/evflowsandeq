ALTER TABLE "customers"
  ADD COLUMN "billing_address" TEXT,
  ADD COLUMN "customer_type" TEXT,
  ADD COLUMN "potential" TEXT,
  ADD COLUMN "collection_schedule" TEXT,
  ADD COLUMN "invoice_exchange_schedule" TEXT,
  ADD COLUMN "payment_method_preference" TEXT,
  ADD COLUMN "payment_tolerance_days" INTEGER,
  ADD COLUMN "legal_documents" JSONB,
  ADD COLUMN "responsible_person" JSONB,
  ADD COLUMN "responsible_license" JSONB,
  ADD COLUMN "noo_document" JSONB;

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_payment_tolerance_days_nonnegative"
  CHECK ("payment_tolerance_days" IS NULL OR "payment_tolerance_days" >= 0);

ALTER TABLE "suppliers"
  ADD COLUMN "legal_documents" JSONB,
  ADD COLUMN "technical_responsible_license" JSONB,
  ADD COLUMN "agreement_details" JSONB;
