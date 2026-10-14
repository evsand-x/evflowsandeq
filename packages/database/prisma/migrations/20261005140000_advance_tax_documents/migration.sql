-- AlterTable
ALTER TABLE "public"."sales_tax_rules" ADD COLUMN     "taxable_event" TEXT NOT NULL DEFAULT 'POD';

-- CreateTable
CREATE TABLE "public"."advance_taxes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "applied_amount" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "advance_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."official_tax_documents" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "document_date" DATE NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "evidence_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "official_tax_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "advance_taxes_receipt_id_key" ON "public"."advance_taxes"("receipt_id");

-- CreateIndex
CREATE INDEX "advance_taxes_company_id_batch_id_idx" ON "public"."advance_taxes"("company_id", "batch_id");

-- CreateIndex
CREATE INDEX "official_tax_documents_company_id_source_type_source_id_idx" ON "public"."official_tax_documents"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "official_tax_documents_company_id_number_key" ON "public"."official_tax_documents"("company_id", "number");

ALTER TABLE advance_taxes ADD CONSTRAINT advance_tax_receipt_fk FOREIGN KEY(receipt_id) REFERENCES customer_receipts(id);
ALTER TABLE advance_taxes ADD CONSTRAINT advance_tax_batch_fk FOREIGN KEY(batch_id) REFERENCES fulfillment_batches(id);
ALTER TABLE advance_taxes ADD CONSTRAINT advance_tax_amounts CHECK(amount > 0 AND applied_amount >= 0 AND applied_amount <= amount);
ALTER TABLE official_tax_documents ADD CONSTRAINT official_tax_evidence_fk FOREIGN KEY(company_id,evidence_id) REFERENCES transaction_evidence(company_id,id);
ALTER TABLE official_tax_documents ADD CONSTRAINT official_tax_customer_fk FOREIGN KEY(customer_id) REFERENCES customers(id);
ALTER TABLE sales_tax_rules ADD CONSTRAINT sales_tax_event CHECK(taxable_event IN ('POD','ADVANCE'));
CREATE UNIQUE INDEX official_tax_source_active ON official_tax_documents(company_id,source_type,source_id) WHERE state <> 'REJECTED';


