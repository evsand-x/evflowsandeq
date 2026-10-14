-- Supplier invoice matching, AP open item and posting.
ALTER TYPE "public"."LedgerEntryKind" ADD VALUE 'PURCHASE_TAX';
CREATE TYPE "public"."SupplierInvoiceState" AS ENUM ('DRAFT', 'MATCHED', 'POSTED', 'VOID');

ALTER TABLE "public"."purchase_order_lines"
  ADD COLUMN "invoiced_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0;

CREATE TABLE "public"."supplier_invoices" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "purchase_order_id" UUID NOT NULL,
  "external_number" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "invoice_date" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "subtotal" DECIMAL(24,8) NOT NULL,
  "tax_amount" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "total" DECIMAL(24,8) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "state" "public"."SupplierInvoiceState" NOT NULL DEFAULT 'DRAFT',
  "idempotency_key" TEXT NOT NULL,
  "posted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" UUID NOT NULL,
  CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supplier_invoices_company_external_supplier_key" ON "public"."supplier_invoices"("company_id", "external_number", "supplier_id");
CREATE UNIQUE INDEX "supplier_invoices_company_number_key" ON "public"."supplier_invoices"("company_id", "number");
CREATE UNIQUE INDEX "supplier_invoices_company_idempotency_key_key" ON "public"."supplier_invoices"("company_id", "idempotency_key");

CREATE TABLE "public"."supplier_invoice_lines" (
  "id" UUID NOT NULL,
  "supplier_invoice_id" UUID NOT NULL,
  "purchase_order_line_id" UUID NOT NULL,
  "quantity" DECIMAL(24,10) NOT NULL,
  "unit_cost" DECIMAL(24,8) NOT NULL,
  CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supplier_invoice_lines_invoice_po_line_key" ON "public"."supplier_invoice_lines"("supplier_invoice_id", "purchase_order_line_id");

CREATE TABLE "public"."payable_open_items" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "supplier_invoice_id" UUID NOT NULL,
  "original_amount" DECIMAL(24,8) NOT NULL,
  "outstanding_amount" DECIMAL(24,8) NOT NULL,
  "due_date" DATE NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "state" TEXT NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "payable_open_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payable_open_items_supplier_invoice_key" ON "public"."payable_open_items"("supplier_invoice_id");
CREATE INDEX "payable_open_items_company_supplier_state_due_idx" ON "public"."payable_open_items"("company_id", "supplier_id", "state", "due_date");

ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_po_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_invoice_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_po_line_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."payable_open_items" ADD CONSTRAINT "payable_open_items_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."payable_open_items" ADD CONSTRAINT "payable_open_items_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."payable_open_items" ADD CONSTRAINT "payable_open_items_invoice_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
