ALTER TABLE "products"
  ADD COLUMN "storage_profile" JSONB,
  ADD COLUMN "shelf_life_days" INTEGER,
  ADD COLUMN "storage_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "storage_verified_by_id" UUID;

ALTER TABLE "product_registrations"
  ADD COLUMN "disposition_by_id" UUID,
  ADD COLUMN "disposition_at" TIMESTAMPTZ(6),
  ADD COLUMN "disposition_reason" TEXT;

ALTER TABLE "products" ADD CONSTRAINT "products_shelf_life_days_nonnegative"
  CHECK ("shelf_life_days" IS NULL OR "shelf_life_days" >= 0);
