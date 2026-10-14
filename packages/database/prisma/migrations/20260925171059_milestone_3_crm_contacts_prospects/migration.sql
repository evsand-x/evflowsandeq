-- CreateEnum
CREATE TYPE "public"."ContactState" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."ProspectApproachStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'POTENTIAL', 'DEFERRED', 'DROPPED');

-- CreateTable
CREATE TABLE "public"."contacts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "nickname" TEXT,
    "job_title" TEXT,
    "department" TEXT,
    "pic_functions" JSONB NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "birth_date" DATE,
    "state" "public"."ContactState" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prospects" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT,
    "owner_id" UUID NOT NULL,
    "approach_status" "public"."ProspectApproachStatus" NOT NULL DEFAULT 'NEW',
    "next_action" TEXT,
    "next_action_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prospect_needs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "product_id" UUID,
    "description" TEXT,
    "estimated_qty" DECIMAL(24,10),
    "uom_id" UUID,
    "needed_on" DATE,
    "needed_period" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "prospect_needs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_company_id_customer_id_state_full_name_idx" ON "public"."contacts"("company_id", "customer_id", "state", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_company_id_code_key" ON "public"."contacts"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_customer_id_key" ON "public"."prospects"("customer_id");

-- CreateIndex
CREATE INDEX "prospects_company_id_approach_status_owner_id_idx" ON "public"."prospects"("company_id", "approach_status", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_company_id_code_key" ON "public"."prospects"("company_id", "code");

-- CreateIndex
CREATE INDEX "prospect_needs_company_id_prospect_id_idx" ON "public"."prospect_needs"("company_id", "prospect_id");

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prospects" ADD CONSTRAINT "prospects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prospects" ADD CONSTRAINT "prospects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prospect_needs" ADD CONSTRAINT "prospect_needs_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prospect_needs" ADD CONSTRAINT "prospect_needs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prospect_needs" ADD CONSTRAINT "prospect_needs_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
