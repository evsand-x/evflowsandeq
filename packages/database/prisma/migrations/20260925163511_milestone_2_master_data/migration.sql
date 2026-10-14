-- CreateEnum
CREATE TYPE "public"."MasterRecordState" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ProductRegistrationStatus" AS ENUM ('PENDING', 'VALID', 'EXPIRED', 'INVALID');

-- CreateEnum
CREATE TYPE "public"."MasterPriceKind" AS ENUM ('PURCHASE', 'SALE');

-- CreateEnum
CREATE TYPE "public"."CustomerRelationshipStage" AS ENUM ('PROSPECT', 'REGISTERED', 'TRANSACTED');

-- CreateEnum
CREATE TYPE "public"."CustomerOnboardingState" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'VERIFIED');

-- CreateEnum
CREATE TYPE "public"."VendorType" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "public"."LocatorType" AS ENUM ('RECEIVING', 'STORAGE', 'QUARANTINE', 'TRANSIT', 'CONSIGNMENT', 'DISPATCH', 'RETURN');

-- CreateEnum
CREATE TYPE "public"."OperationalItemKind" AS ENUM ('SUPPLY', 'ASSET_MODEL', 'SERVICE');

-- CreateTable
CREATE TABLE "public"."master_code_sequences" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "next_value" BIGINT NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_code_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_categories" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."uoms" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "uoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "base_uom_id" UUID NOT NULL,
    "batch_required" BOOLEAN NOT NULL DEFAULT true,
    "expiry_required" BOOLEAN NOT NULL DEFAULT true,
    "serial_required" BOOLEAN NOT NULL DEFAULT false,
    "storage_notes" TEXT,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_registrations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "permit_type" TEXT NOT NULL,
    "permit_number" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "issued_on" DATE,
    "expires_on" DATE,
    "status" "public"."ProductRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "evidence_object_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "product_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_uoms" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "factor_to_base" DECIMAL(24,10) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "product_uoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_reference_prices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "kind" "public"."MasterPriceKind" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "unit_price" DECIMAL(24,8) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "product_reference_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_channels" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "customer_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rayons" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "coverage_notes" TEXT,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "rayons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "channel_id" UUID,
    "rayon_id" UUID,
    "relationship_stage" "public"."CustomerRelationshipStage" NOT NULL DEFAULT 'PROSPECT',
    "onboarding_state" "public"."CustomerOnboardingState" NOT NULL DEFAULT 'DRAFT',
    "primary_address" TEXT,
    "shipping_address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "tax_identity" TEXT,
    "tax_status" TEXT,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "primary_address" TEXT,
    "phone" TEXT,
    "sales_contact" JSONB,
    "finance_contact" JSONB,
    "shipping_contact" JSONB,
    "tax_identity" TEXT,
    "technical_responsible_name" TEXT,
    "agreement_number" TEXT,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendors" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "vendor_type" "public"."VendorType" NOT NULL,
    "categories" JSONB NOT NULL,
    "primary_address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "order_contact" JSONB,
    "finance_contact" JSONB,
    "service_contact" JSONB,
    "tax_identity" TEXT,
    "tax_status" TEXT,
    "agreement_number" TEXT,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."warehouses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locators" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "locator_type" "public"."LocatorType" NOT NULL,
    "pick_sequence" INTEGER,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "locators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."operational_items" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "kind" "public"."OperationalItemKind" NOT NULL,
    "category" TEXT NOT NULL,
    "specification" TEXT,
    "base_uom_id" UUID NOT NULL,
    "reference_purchase_price" DECIMAL(24,8),
    "currency" CHAR(3),
    "minimum_stock" DECIMAL(20,6),
    "stock_controlled" BOOLEAN NOT NULL DEFAULT false,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "operational_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_code_sequences_company_id_entity_type_key" ON "public"."master_code_sequences"("company_id", "entity_type");

-- CreateIndex
CREATE INDEX "product_categories_company_id_state_name_idx" ON "public"."product_categories"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_company_id_code_key" ON "public"."product_categories"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_company_id_normalized_name_key" ON "public"."product_categories"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "uoms_company_id_state_name_idx" ON "public"."uoms"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uoms_company_id_code_key" ON "public"."uoms"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uoms_company_id_normalized_name_key" ON "public"."uoms"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "products_company_id_state_name_idx" ON "public"."products"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_company_id_code_key" ON "public"."products"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "products_company_id_normalized_name_key" ON "public"."products"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "product_registrations_company_id_product_id_status_idx" ON "public"."product_registrations"("company_id", "product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_registrations_company_id_permit_type_permit_number_key" ON "public"."product_registrations"("company_id", "permit_type", "permit_number");

-- CreateIndex
CREATE INDEX "product_uoms_company_id_product_id_active_idx" ON "public"."product_uoms"("company_id", "product_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "product_uoms_product_id_uom_id_effective_from_key" ON "public"."product_uoms"("product_id", "uom_id", "effective_from");

-- CreateIndex
CREATE INDEX "product_reference_prices_company_id_product_id_kind_effecti_idx" ON "public"."product_reference_prices"("company_id", "product_id", "kind", "effective_from");

-- CreateIndex
CREATE INDEX "customer_channels_company_id_state_name_idx" ON "public"."customer_channels"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_channels_company_id_code_key" ON "public"."customer_channels"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_channels_company_id_normalized_name_key" ON "public"."customer_channels"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "rayons_company_id_state_name_idx" ON "public"."rayons"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "rayons_company_id_code_key" ON "public"."rayons"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "rayons_company_id_normalized_name_key" ON "public"."rayons"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "customers_company_id_state_name_idx" ON "public"."customers"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_code_key" ON "public"."customers"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_normalized_name_key" ON "public"."customers"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "suppliers_company_id_state_name_idx" ON "public"."suppliers"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_company_id_code_key" ON "public"."suppliers"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_company_id_normalized_name_key" ON "public"."suppliers"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "vendors_company_id_state_name_idx" ON "public"."vendors"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_company_id_code_key" ON "public"."vendors"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_company_id_normalized_name_key" ON "public"."vendors"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "warehouses_company_id_state_name_idx" ON "public"."warehouses"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_company_id_code_key" ON "public"."warehouses"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_company_id_normalized_name_key" ON "public"."warehouses"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "locators_company_id_warehouse_id_state_idx" ON "public"."locators"("company_id", "warehouse_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "locators_warehouse_id_code_key" ON "public"."locators"("warehouse_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "locators_warehouse_id_normalized_name_key" ON "public"."locators"("warehouse_id", "normalized_name");

-- CreateIndex
CREATE INDEX "operational_items_company_id_state_name_idx" ON "public"."operational_items"("company_id", "state", "name");

-- CreateIndex
CREATE UNIQUE INDEX "operational_items_company_id_code_key" ON "public"."operational_items"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "operational_items_company_id_normalized_name_key" ON "public"."operational_items"("company_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "public"."master_code_sequences" ADD CONSTRAINT "master_code_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_categories" ADD CONSTRAINT "product_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."uoms" ADD CONSTRAINT "uoms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_base_uom_id_fkey" FOREIGN KEY ("base_uom_id") REFERENCES "public"."uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_registrations" ADD CONSTRAINT "product_registrations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_uoms" ADD CONSTRAINT "product_uoms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_uoms" ADD CONSTRAINT "product_uoms_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_reference_prices" ADD CONSTRAINT "product_reference_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_reference_prices" ADD CONSTRAINT "product_reference_prices_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_channels" ADD CONSTRAINT "customer_channels_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rayons" ADD CONSTRAINT "rayons_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."customer_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_rayon_id_fkey" FOREIGN KEY ("rayon_id") REFERENCES "public"."rayons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendors" ADD CONSTRAINT "vendors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locators" ADD CONSTRAINT "locators_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."operational_items" ADD CONSTRAINT "operational_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."operational_items" ADD CONSTRAINT "operational_items_base_uom_id_fkey" FOREIGN KEY ("base_uom_id") REFERENCES "public"."uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."role_permissions_role_permission_scope_key" RENAME TO "role_permissions_role_id_permission_id_scope_type_scope_id_key";
