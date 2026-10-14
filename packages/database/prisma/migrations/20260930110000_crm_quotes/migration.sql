CREATE TYPE "public"."QuoteState" AS ENUM ('DRAFT', 'ISSUED', 'SUPERSEDED', 'EXPIRED', 'CANCELLED');
CREATE TABLE "public"."quotes" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "prospect_id" UUID,
  "opportunity_id" UUID,
  "code" TEXT NOT NULL,
  "version_no" INTEGER NOT NULL DEFAULT 1,
  "state" "public"."QuoteState" NOT NULL DEFAULT 'DRAFT',
  "issued_at" TIMESTAMPTZ(6),
  "valid_until" DATE,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."quote_lines" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "quote_id" UUID NOT NULL,
  "source_need_id" UUID,
  "product_id" UUID,
  "description" TEXT,
  "quantity" DECIMAL(24,10) NOT NULL,
  "uom_id" UUID NOT NULL,
  "unit_price" DECIMAL(24,8),
  "discount" DECIMAL(24,8),
  "net_amount" DECIMAL(24,8),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" UUID NOT NULL,
  CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quotes_company_id_code_key" ON "public"."quotes"("company_id", "code");
CREATE INDEX "quotes_company_id_customer_id_state_valid_until_idx" ON "public"."quotes"("company_id", "customer_id", "state", "valid_until");
CREATE UNIQUE INDEX "quote_lines_quote_id_source_need_id_key" ON "public"."quote_lines"("quote_id", "source_need_id");
CREATE INDEX "quote_lines_company_id_quote_id_idx" ON "public"."quote_lines"("company_id", "quote_id");
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quote_lines" ADD CONSTRAINT "quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quote_lines" ADD CONSTRAINT "quote_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quote_lines" ADD CONSTRAINT "quote_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quote_lines" ADD CONSTRAINT "quote_lines_source_need_id_fkey" FOREIGN KEY ("source_need_id") REFERENCES "public"."prospect_needs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
