-- CreateEnum
CREATE TYPE "public"."SalesOrderState" AS ENUM ('DRAFT', 'OPEN', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."FulfillmentState" AS ENUM ('ALLOCATED', 'DISPATCHED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "public"."PurchaseRequestState" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIALLY_FULFILLED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderState" AS ENUM ('DRAFT', 'OPEN', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."GoodsReceiptState" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "public"."SalesInvoiceState" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "public"."LedgerEntryKind" AS ENUM ('OPENING_STOCK', 'SALE_REVENUE', 'SALE_COGS', 'AR', 'PURCHASE_RECEIPT', 'AP');

-- CreateEnum
CREATE TYPE "public"."InventoryMovementKind" AS ENUM ('OPENING_RECEIPT', 'RESERVATION', 'RELEASE', 'DISPATCH', 'RECEIPT');

-- CreateTable
CREATE TABLE "public"."stock_lots" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "locator_id" UUID NOT NULL,
    "batch_no" TEXT NOT NULL,
    "expiry_date" DATE,
    "quantity_on_hand" DECIMAL(24,10) NOT NULL,
    "quantity_reserved" DECIMAL(24,10) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(24,8) NOT NULL,
    "state" "public"."MasterRecordState" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_movements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "stock_lot_id" UUID NOT NULL,
    "kind" "public"."InventoryMovementKind" NOT NULL,
    "quantity" DECIMAL(24,10) NOT NULL,
    "unit_cost" DECIMAL(24,8) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "state" "public"."SalesOrderState" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_order_lines" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "ordered_quantity" DECIMAL(24,10) NOT NULL,
    "allocated_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0,
    "backorder_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(24,8) NOT NULL,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fulfillment_batches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "state" "public"."FulfillmentState" NOT NULL DEFAULT 'ALLOCATED',
    "number" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(6),
    "pod_at" TIMESTAMPTZ(6),

    CONSTRAINT "fulfillment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fulfillment_allocations" (
    "id" UUID NOT NULL,
    "fulfillment_batch_id" UUID NOT NULL,
    "sales_order_line_id" UUID NOT NULL,
    "stock_lot_id" UUID NOT NULL,
    "quantity" DECIMAL(24,10) NOT NULL,

    CONSTRAINT "fulfillment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_receipts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "fulfillment_batch_id" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_quantity" DECIMAL(24,10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_invoices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "delivery_receipt_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "state" "public"."SalesInvoiceState" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "subtotal" DECIMAL(24,8) NOT NULL,
    "posted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_sales_order_id" UUID,
    "number" TEXT NOT NULL,
    "state" "public"."PurchaseRequestState" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_request_lines" (
    "id" UUID NOT NULL,
    "purchase_request_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(24,10) NOT NULL,

    CONSTRAINT "purchase_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "purchase_request_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "state" "public"."PurchaseOrderState" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_order_lines" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "ordered_quantity" DECIMAL(24,10) NOT NULL,
    "received_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(24,8) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goods_receipts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "state" "public"."GoodsReceiptState" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goods_receipt_lines" (
    "id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "purchase_order_line_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(24,10) NOT NULL,
    "batch_no" TEXT NOT NULL,
    "expiry_date" DATE,
    "unit_cost" DECIMAL(24,8) NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ledger_entries" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "kind" "public"."LedgerEntryKind" NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "debit" DECIMAL(24,8) NOT NULL,
    "credit" DECIMAL(24,8) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salesInvoiceId" UUID,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_lots_company_id_product_id_expiry_date_idx" ON "public"."stock_lots"("company_id", "product_id", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "stock_lots_company_id_product_id_warehouse_id_locator_id_ba_key" ON "public"."stock_lots"("company_id", "product_id", "warehouse_id", "locator_id", "batch_no");

-- CreateIndex
CREATE INDEX "inventory_movements_company_id_stock_lot_id_created_at_idx" ON "public"."inventory_movements"("company_id", "stock_lot_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_company_id_idempotency_key_key" ON "public"."inventory_movements"("company_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_customer_id_state_idx" ON "public"."sales_orders"("company_id", "customer_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_company_id_number_key" ON "public"."sales_orders"("company_id", "number");

-- CreateIndex
CREATE INDEX "sales_order_lines_company_id_sales_order_id_idx" ON "public"."sales_order_lines"("company_id", "sales_order_id");

-- CreateIndex
CREATE INDEX "fulfillment_batches_company_id_sales_order_id_state_idx" ON "public"."fulfillment_batches"("company_id", "sales_order_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_batches_company_id_number_key" ON "public"."fulfillment_batches"("company_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_allocations_fulfillment_batch_id_sales_order_li_key" ON "public"."fulfillment_allocations"("fulfillment_batch_id", "sales_order_line_id", "stock_lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_receipts_fulfillment_batch_id_key" ON "public"."delivery_receipts"("fulfillment_batch_id");

-- CreateIndex
CREATE INDEX "delivery_receipts_company_id_sales_order_id_accepted_at_idx" ON "public"."delivery_receipts"("company_id", "sales_order_id", "accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_company_id_number_key" ON "public"."sales_invoices"("company_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_delivery_receipt_id_key" ON "public"."sales_invoices"("delivery_receipt_id");

-- CreateIndex
CREATE INDEX "purchase_requests_company_id_state_idx" ON "public"."purchase_requests"("company_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_company_id_number_key" ON "public"."purchase_requests"("company_id", "number");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_state_idx" ON "public"."purchase_orders"("company_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_company_id_number_key" ON "public"."purchase_orders"("company_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_company_id_number_key" ON "public"."goods_receipts"("company_id", "number");

-- CreateIndex
CREATE INDEX "ledger_entries_company_id_created_at_idx" ON "public"."ledger_entries"("company_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_company_id_kind_source_type_source_id_debit__key" ON "public"."ledger_entries"("company_id", "kind", "source_type", "source_id", "debit", "credit");

-- AddForeignKey
ALTER TABLE "public"."stock_lots" ADD CONSTRAINT "stock_lots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_lots" ADD CONSTRAINT "stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_lots" ADD CONSTRAINT "stock_lots_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_lots" ADD CONSTRAINT "stock_lots_locator_id_fkey" FOREIGN KEY ("locator_id") REFERENCES "public"."locators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_stock_lot_id_fkey" FOREIGN KEY ("stock_lot_id") REFERENCES "public"."stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "public"."fulfillment_batches" ADD CONSTRAINT "fulfillment_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fulfillment_batches" ADD CONSTRAINT "fulfillment_batches_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_fulfillment_batch_id_fkey" FOREIGN KEY ("fulfillment_batch_id") REFERENCES "public"."fulfillment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_stock_lot_id_fkey" FOREIGN KEY ("stock_lot_id") REFERENCES "public"."stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_receipts" ADD CONSTRAINT "delivery_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_receipts" ADD CONSTRAINT "delivery_receipts_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_receipts" ADD CONSTRAINT "delivery_receipts_fulfillment_batch_id_fkey" FOREIGN KEY ("fulfillment_batch_id") REFERENCES "public"."fulfillment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_invoices" ADD CONSTRAINT "sales_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_invoices" ADD CONSTRAINT "sales_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_invoices" ADD CONSTRAINT "sales_invoices_delivery_receipt_id_fkey" FOREIGN KEY ("delivery_receipt_id") REFERENCES "public"."delivery_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_requests" ADD CONSTRAINT "purchase_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_requests" ADD CONSTRAINT "purchase_requests_source_sales_order_id_fkey" FOREIGN KEY ("source_sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "public"."ledger_entries" ADD CONSTRAINT "ledger_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ledger_entries" ADD CONSTRAINT "ledger_entries_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "public"."sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;


