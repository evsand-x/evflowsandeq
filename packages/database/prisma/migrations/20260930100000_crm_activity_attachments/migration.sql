CREATE TYPE "public"."CrmActivityKind" AS ENUM ('NOTE', 'CALL', 'MEETING', 'EMAIL', 'FOLLOW_UP');
CREATE TYPE "public"."AttachmentScanState" AS ENUM ('PENDING_SCAN', 'AVAILABLE', 'REJECTED');

CREATE TABLE "public"."crm_activities" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_id" UUID,
  "contact_id" UUID,
  "prospect_id" UUID,
  "opportunity_id" UUID,
  "kind" "public"."CrmActivityKind" NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "summary" TEXT NOT NULL,
  "outcome" TEXT,
  "next_action" TEXT,
  "next_action_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" UUID NOT NULL,
  CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_activities_company_id_occurred_at_idx" ON "public"."crm_activities"("company_id", "occurred_at");
CREATE INDEX "crm_activities_company_id_customer_id_occurred_at_idx" ON "public"."crm_activities"("company_id", "customer_id", "occurred_at");
CREATE INDEX "crm_activities_company_id_prospect_id_occurred_at_idx" ON "public"."crm_activities"("company_id", "prospect_id", "occurred_at");

CREATE TABLE "public"."attachments" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" UUID NOT NULL,
  "object_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "sha256" TEXT,
  "scan_state" "public"."AttachmentScanState" NOT NULL DEFAULT 'PENDING_SCAN',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scanned_at" TIMESTAMPTZ(6),
  "created_by_id" UUID NOT NULL,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attachments_company_id_object_key_key" ON "public"."attachments"("company_id", "object_key");
CREATE INDEX "attachments_company_id_resource_type_resource_id_created_at_idx" ON "public"."attachments"("company_id", "resource_type", "resource_id", "created_at");

ALTER TABLE "public"."crm_activities" ADD CONSTRAINT "crm_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."crm_activities" ADD CONSTRAINT "crm_activities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."crm_activities" ADD CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."crm_activities" ADD CONSTRAINT "crm_activities_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
