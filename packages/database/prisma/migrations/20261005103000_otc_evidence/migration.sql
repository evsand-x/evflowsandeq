







-- AlterTable
ALTER TABLE "public"."customer_receipts" ADD COLUMN     "bank_reference" TEXT,
ADD COLUMN     "evidence_id" UUID;

-- AlterTable
ALTER TABLE "public"."delivery_receipts" ADD COLUMN     "evidence_id" UUID,
ADD COLUMN     "receiver_name" TEXT;

-- AlterTable
ALTER TABLE "public"."fulfillment_batches" ADD COLUMN     "shipment_snapshot" JSONB;

-- AlterTable
ALTER TABLE "public"."sales_orders" ADD COLUMN     "customer_reference" TEXT,
ADD COLUMN     "delivery_address" TEXT,
ADD COLUMN     "evidence_id" UUID,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "public"."transaction_evidence" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fulfillment_documents" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "issued_by_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_evidence_company_id_purpose_idx" ON "public"."transaction_evidence"("company_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_documents_company_id_batch_id_kind_key" ON "public"."fulfillment_documents"("company_id", "batch_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_documents_company_id_number_key" ON "public"."fulfillment_documents"("company_id", "number");


