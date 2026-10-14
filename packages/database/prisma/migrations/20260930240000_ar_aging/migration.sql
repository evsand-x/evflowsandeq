ALTER TABLE "public"."sales_invoices" ADD COLUMN "due_date" DATE;
UPDATE "public"."sales_invoices" SET "due_date" = COALESCE("posted_at"::date, CURRENT_DATE) WHERE "due_date" IS NULL;
ALTER TABLE "public"."sales_invoices" ALTER COLUMN "due_date" SET NOT NULL;
