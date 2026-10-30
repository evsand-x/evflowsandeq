CREATE TYPE "StockCountState" AS ENUM ('DRAFT','SUBMITTED','APPROVED','POSTED','REJECTED');
CREATE TABLE "stock_counts" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "state" "StockCountState" NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "submitted_at" TIMESTAMPTZ(6),
  "submitted_by_id" UUID,
  "approved_at" TIMESTAMPTZ(6),
  "approved_by_id" UUID,
  "posted_at" TIMESTAMPTZ(6),
  "posted_by_id" UUID,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_counts_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_counts_warehouse_fk" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_counts_company_idempotency_key_key" ON "stock_counts"("company_id","idempotency_key");
CREATE INDEX "stock_counts_company_state_created_idx" ON "stock_counts"("company_id","state","created_at");
CREATE TABLE "stock_count_lines" (
  "id" UUID NOT NULL,
  "stock_count_id" UUID NOT NULL,
  "stock_lot_id" UUID NOT NULL,
  "expected_quantity" DECIMAL(24,10) NOT NULL,
  "counted_quantity" DECIMAL(24,10) NOT NULL,
  "unit_cost" DECIMAL(24,8) NOT NULL,
  CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_count_lines_count_fk" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_count_lines_lot_fk" FOREIGN KEY ("stock_lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_count_lines_count_lot_key" ON "stock_count_lines"("stock_count_id","stock_lot_id");
