-- CreateEnum
CREATE TYPE "public"."OpportunityState" AS ENUM ('DRAFT', 'OPEN', 'CLOSED_WON', 'CLOSED_LOST');

CREATE TABLE "public"."opportunities" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "prospect_id" UUID,
  "customer_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "owner_id" UUID NOT NULL,
  "contact_ids" JSONB NOT NULL DEFAULT '[]',
  "state" "public"."OpportunityState" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."opportunity_lines" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "source_need_id" UUID,
  "product_id" UUID,
  "description" TEXT,
  "estimated_qty" DECIMAL(24,10),
  "uom_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" UUID NOT NULL,
  CONSTRAINT "opportunity_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "opportunities_company_id_code_key" ON "public"."opportunities"("company_id", "code");
CREATE INDEX "opportunities_company_id_customer_id_period_state_idx" ON "public"."opportunities"("company_id", "customer_id", "period", "state");
CREATE INDEX "opportunity_lines_company_id_opportunity_id_idx" ON "public"."opportunity_lines"("company_id", "opportunity_id");
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."opportunity_lines" ADD CONSTRAINT "opportunity_lines_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."opportunity_lines" ADD CONSTRAINT "opportunity_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."opportunity_lines" ADD CONSTRAINT "opportunity_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunity_draft_only" CHECK (state = 'DRAFT');
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunity_period_format" CHECK (period ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$');
ALTER TABLE "public"."opportunity_lines" ADD CONSTRAINT "opportunity_qty_positive" CHECK (estimated_qty IS NULL OR estimated_qty > 0);
ALTER TABLE "public"."opportunity_lines" ADD CONSTRAINT "opportunity_source_need_fkey" FOREIGN KEY (source_need_id) REFERENCES "public"."prospect_needs"(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX "opportunity_source_unique" ON "public"."opportunity_lines"(opportunity_id, source_need_id);
