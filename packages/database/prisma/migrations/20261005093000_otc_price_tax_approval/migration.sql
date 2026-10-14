-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'INVENTORY';
ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'INVENTORY_TRANSIT';
ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'SALES_TAX';

-- AlterTable
ALTER TABLE "public"."purchase_requests" ADD COLUMN     "approval_snapshot" JSONB,
ADD COLUMN     "approval_value" DECIMAL(24,8),
ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "currency" CHAR(3) NOT NULL DEFAULT 'IDR';

-- AlterTable
ALTER TABLE "public"."sales_invoices" ADD COLUMN     "tax_amount" DECIMAL(24,8) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(24,8);

-- AlterTable
ALTER TABLE "public"."sales_order_lines" ADD COLUMN     "price_snapshot" JSONB,
ADD COLUMN     "tax_snapshot" JSONB;

-- CreateTable
CREATE TABLE "public"."sales_tax_rules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_reference" TEXT NOT NULL,
    "rate" DECIMAL(12,8) NOT NULL,
    "dpp_factor" DECIMAL(24,10) NOT NULL,
    "decimal_places" INTEGER NOT NULL,
    "rounding" TEXT NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transaction_approval_policies" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "document_kind" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "maximum_amount" DECIMAL(24,8) NOT NULL,
    "allow_self" BOOLEAN NOT NULL DEFAULT false,
    "steps" JSONB NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transaction_approval_actions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "actor_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_tax_rules_company_id_customer_id_product_id_effective_idx" ON "public"."sales_tax_rules"("company_id", "customer_id", "product_id", "effective_from");

-- CreateIndex
CREATE INDEX "transaction_approval_policies_company_id_document_kind_effe_idx" ON "public"."transaction_approval_policies"("company_id", "document_kind", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_approval_actions_company_id_source_id_policy_id_key" ON "public"."transaction_approval_actions"("company_id", "source_id", "policy_id", "step", "actor_id");


