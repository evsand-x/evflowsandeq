-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'WAPU_TAX';
ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'WITHHELD_TAX';

-- AlterTable
ALTER TABLE "public"."customer_receipts" ADD COLUMN     "bank_account_id" UUID;

-- AlterTable
ALTER TABLE "public"."ledger_entries" ADD COLUMN     "journal_id" UUID;

-- CreateTable
CREATE TABLE "public"."finance_accounts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "control_kind" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance_periods" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "finance_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance_posting_profiles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE NOT NULL,
    "mappings" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_posting_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance_journals" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "period_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "actor_id" UUID NOT NULL,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance_journal_lines" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "ledger_kind" TEXT NOT NULL,
    "debit" DECIMAL(24,8) NOT NULL,
    "credit" DECIMAL(24,8) NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "finance_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance_bank_accounts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "last_four" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "account_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "finance_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_statements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "opening_balance" DECIMAL(24,8) NOT NULL,
    "closing_balance" DECIMAL(24,8) NOT NULL,
    "source_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'STAGING',
    "created_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "closed_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "review_snapshot" JSONB,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_statement_lines" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "statement_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "value_date" DATE NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "description" TEXT NOT NULL,
    "receipt_id" UUID,
    "matched_by_id" UUID,
    "matched_at" TIMESTAMPTZ(6),

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receipt_tax_rules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "tax_type" TEXT NOT NULL,
    "rate" DECIMAL(12,8) NOT NULL,
    "dpp_factor" DECIMAL(12,8) NOT NULL,
    "decimal_places" INTEGER NOT NULL,
    "rounding" TEXT NOT NULL,
    "legal_reference" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE NOT NULL,

    CONSTRAINT "receipt_tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receipt_tax_components" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "tax_type" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "dpp" DECIMAL(24,8) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "number" TEXT NOT NULL,
    "document_date" DATE NOT NULL,
    "tax_period" TEXT NOT NULL,
    "evidence_id" UUID NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "created_by_id" UUID NOT NULL,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "posted_at" TIMESTAMPTZ(6),

    CONSTRAINT "receipt_tax_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounts_company_id_code_key" ON "public"."finance_accounts"("company_id", "code");

-- CreateIndex
CREATE INDEX "finance_periods_company_id_starts_on_ends_on_idx" ON "public"."finance_periods"("company_id", "starts_on", "ends_on");

-- CreateIndex
CREATE INDEX "finance_posting_profiles_company_id_effective_from_idx" ON "public"."finance_posting_profiles"("company_id", "effective_from");

-- CreateIndex
CREATE INDEX "finance_journals_company_id_business_date_idx" ON "public"."finance_journals"("company_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "finance_journals_company_id_source_type_source_id_key" ON "public"."finance_journals"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "finance_journal_lines_company_id_account_id_idx" ON "public"."finance_journal_lines"("company_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "finance_bank_accounts_company_id_code_key" ON "public"."finance_bank_accounts"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statements_company_id_bank_account_id_source_hash_key" ON "public"."bank_statements"("company_id", "bank_account_id", "source_hash");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_receipt_id_key" ON "public"."bank_statement_lines"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_company_id_bank_account_id_external_id_key" ON "public"."bank_statement_lines"("company_id", "bank_account_id", "external_id");

-- CreateIndex
CREATE INDEX "receipt_tax_rules_company_id_customer_id_kind_tax_type_idx" ON "public"."receipt_tax_rules"("company_id", "customer_id", "kind", "tax_type");

-- CreateIndex
CREATE INDEX "receipt_tax_components_company_id_invoice_id_idx" ON "public"."receipt_tax_components"("company_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_tax_components_company_id_customer_id_tax_type_numb_key" ON "public"."receipt_tax_components"("company_id", "customer_id", "tax_type", "number", "tax_period");

-- AddForeignKey
ALTER TABLE "public"."finance_journal_lines" ADD CONSTRAINT "finance_journal_lines_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "public"."finance_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['finance_accounts','finance_periods','finance_posting_profiles','finance_journals','finance_journal_lines','finance_bank_accounts','bank_statements','bank_statement_lines','receipt_tax_rules','receipt_tax_components'] LOOP
   EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(company_id) REFERENCES companies(id)', t, t || '_company_fk');
 END LOOP;
END $$;
ALTER TABLE finance_journal_lines ADD CONSTRAINT journal_line_account_fk FOREIGN KEY(account_id) REFERENCES finance_accounts(id);
ALTER TABLE finance_journal_lines ADD CONSTRAINT journal_line_nonnegative CHECK(debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0));
ALTER TABLE finance_journals ADD CONSTRAINT journal_period_fk FOREIGN KEY(period_id) REFERENCES finance_periods(id);
ALTER TABLE finance_journals ADD CONSTRAINT journal_profile_fk FOREIGN KEY(profile_id) REFERENCES finance_posting_profiles(id);
ALTER TABLE finance_bank_accounts ADD CONSTRAINT bank_account_gl_fk FOREIGN KEY(account_id) REFERENCES finance_accounts(id);
ALTER TABLE customer_receipts ADD CONSTRAINT receipt_bank_account_fk FOREIGN KEY(bank_account_id) REFERENCES finance_bank_accounts(id);
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_journal_fk FOREIGN KEY(journal_id) REFERENCES finance_journals(id);
ALTER TABLE bank_statements ADD CONSTRAINT statement_bank_fk FOREIGN KEY(bank_account_id) REFERENCES finance_bank_accounts(id);
ALTER TABLE bank_statement_lines ADD CONSTRAINT bank_line_receipt_fk FOREIGN KEY(receipt_id) REFERENCES customer_receipts(id);
ALTER TABLE receipt_tax_components ADD CONSTRAINT receipt_tax_invoice_fk FOREIGN KEY(invoice_id) REFERENCES sales_invoices(id);
ALTER TABLE receipt_tax_components ADD CONSTRAINT receipt_tax_rule_fk FOREIGN KEY(rule_id) REFERENCES receipt_tax_rules(id);
ALTER TABLE receipt_tax_components ADD CONSTRAINT receipt_tax_evidence_fk FOREIGN KEY(company_id,evidence_id) REFERENCES transaction_evidence(company_id,id);
ALTER TABLE receipt_tax_components ADD CONSTRAINT receipt_tax_amount_positive CHECK(amount > 0 AND dpp > 0);
ALTER TABLE receipt_tax_rules ADD CONSTRAINT receipt_tax_rule_bounds CHECK(rate >= 0 AND rate <= 1 AND dpp_factor > 0 AND effective_to > effective_from);
INSERT INTO permissions(id,code,resource,action,description)
SELECT gen_random_uuid(),resource || '.' || action,resource,action,'Finance posting, tax and bank reconciliation'
FROM (VALUES ('posting_profile','read'),('posting_profile','manage'),('journal','read'),
('tax_rule','read'),('tax_component','read'),('tax_component','create'),('tax_component','verify'),('tax_component','post'),
('bank_statement','import'),('bank_reconciliation','read'),('bank_reconciliation','match'),('bank_reconciliation','review'),('bank_reconciliation','close')) AS caps(resource,action)
ON CONFLICT DO NOTHING;


