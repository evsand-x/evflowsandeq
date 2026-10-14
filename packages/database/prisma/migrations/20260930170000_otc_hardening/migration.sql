-- CreateEnum
CREATE TYPE "public"."CustomerPaymentMode" AS ENUM ('COD', 'PREPAY', 'TEMPO');

-- CreateEnum
CREATE TYPE "public"."PickListState" AS ENUM ('OPEN', 'PICKED', 'CHECKED');

-- CreateTable
CREATE TABLE "public"."customer_payment_policies" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "mode" "public"."CustomerPaymentMode" NOT NULL,
    "top_days" INTEGER,
    "credit_limit" DECIMAL(24,8),
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "customer_payment_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pick_lists" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "fulfillment_batch_id" UUID NOT NULL,
    "state" "public"."PickListState" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "picked_at" TIMESTAMPTZ(6),
    "checked_at" TIMESTAMPTZ(6),

    CONSTRAINT "pick_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pick_list_lines" (
    "id" UUID NOT NULL,
    "pick_list_id" UUID NOT NULL,
    "fulfillment_allocation_id" UUID NOT NULL,
    "assigned_quantity" DECIMAL(24,10) NOT NULL,
    "picked_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0,
    "checked_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0,

    CONSTRAINT "pick_list_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_receipt_lines" (
    "id" UUID NOT NULL,
    "delivery_receipt_id" UUID NOT NULL,
    "fulfillment_allocation_id" UUID NOT NULL,
    "accepted_quantity" DECIMAL(24,10) NOT NULL,

    CONSTRAINT "delivery_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_payment_policies_company_id_customer_id_active_eff_idx" ON "public"."customer_payment_policies"("company_id", "customer_id", "active", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "pick_lists_fulfillment_batch_id_key" ON "public"."pick_lists"("fulfillment_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "pick_list_lines_fulfillment_allocation_id_key" ON "public"."pick_list_lines"("fulfillment_allocation_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_receipt_lines_delivery_receipt_id_fulfillment_allo_key" ON "public"."delivery_receipt_lines"("delivery_receipt_id", "fulfillment_allocation_id");

-- AddForeignKey
ALTER TABLE "public"."customer_payment_policies" ADD CONSTRAINT "customer_payment_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_payment_policies" ADD CONSTRAINT "customer_payment_policies_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pick_lists" ADD CONSTRAINT "pick_lists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pick_lists" ADD CONSTRAINT "pick_lists_fulfillment_batch_id_fkey" FOREIGN KEY ("fulfillment_batch_id") REFERENCES "public"."fulfillment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pick_list_lines" ADD CONSTRAINT "pick_list_lines_pick_list_id_fkey" FOREIGN KEY ("pick_list_id") REFERENCES "public"."pick_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pick_list_lines" ADD CONSTRAINT "pick_list_lines_fulfillment_allocation_id_fkey" FOREIGN KEY ("fulfillment_allocation_id") REFERENCES "public"."fulfillment_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_receipt_lines" ADD CONSTRAINT "delivery_receipt_lines_delivery_receipt_id_fkey" FOREIGN KEY ("delivery_receipt_id") REFERENCES "public"."delivery_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_receipt_lines" ADD CONSTRAINT "delivery_receipt_lines_fulfillment_allocation_id_fkey" FOREIGN KEY ("fulfillment_allocation_id") REFERENCES "public"."fulfillment_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

