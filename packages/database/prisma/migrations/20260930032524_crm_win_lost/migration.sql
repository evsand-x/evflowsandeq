-- CreateEnum
CREATE TYPE "public"."CustomerOrderKind" AS ENUM ('PO', 'SP');

-- CreateEnum
CREATE TYPE "public"."CustomerOrderState" AS ENUM ('DRAFT', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."OpportunityOutcomeKind" AS ENUM ('WON', 'LOST');

-- CreateTable
CREATE TABLE "public"."customer_orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "kind" "public"."CustomerOrderKind" NOT NULL,
    "reference_no" TEXT NOT NULL,
    "state" "public"."CustomerOrderState" NOT NULL DEFAULT 'DRAFT',
    "evidence_attachment_ids" JSONB NOT NULL DEFAULT '[]',
    "verified_at" TIMESTAMPTZ(6),
    "verified_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."opportunity_outcomes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "kind" "public"."OpportunityOutcomeKind" NOT NULL,
    "reason" TEXT,
    "maintain_strategy" TEXT,
    "customer_order_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "opportunity_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."opportunity_outcome_lines" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "outcome_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "quantity" DECIMAL(24,10) NOT NULL,

    CONSTRAINT "opportunity_outcome_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_orders_company_id_customer_id_opportunity_id_state_idx" ON "public"."customer_orders"("company_id", "customer_id", "opportunity_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "customer_orders_company_id_kind_reference_no_key" ON "public"."customer_orders"("company_id", "kind", "reference_no");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_outcomes_opportunity_id_key" ON "public"."opportunity_outcomes"("opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_outcomes_customer_order_id_key" ON "public"."opportunity_outcomes"("customer_order_id");

-- CreateIndex
CREATE INDEX "opportunity_outcomes_company_id_kind_created_at_idx" ON "public"."opportunity_outcomes"("company_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "opportunity_outcome_lines_company_id_line_id_idx" ON "public"."opportunity_outcome_lines"("company_id", "line_id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_outcome_lines_outcome_id_line_id_key" ON "public"."opportunity_outcome_lines"("outcome_id", "line_id");

-- AddForeignKey
ALTER TABLE "public"."customer_orders" ADD CONSTRAINT "customer_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_orders" ADD CONSTRAINT "customer_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_orders" ADD CONSTRAINT "customer_orders_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunity_outcomes" ADD CONSTRAINT "opportunity_outcomes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunity_outcomes" ADD CONSTRAINT "opportunity_outcomes_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunity_outcomes" ADD CONSTRAINT "opportunity_outcomes_customer_order_id_fkey" FOREIGN KEY ("customer_order_id") REFERENCES "public"."customer_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunity_outcome_lines" ADD CONSTRAINT "opportunity_outcome_lines_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "public"."opportunity_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunity_outcome_lines" ADD CONSTRAINT "opportunity_outcome_lines_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "public"."opportunity_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

