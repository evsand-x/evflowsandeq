ALTER TABLE "sales_orders"
  ADD COLUMN "order_date" DATE,
  ADD COLUMN "payment_term_code" TEXT,
  ADD COLUMN "salesperson_id" UUID,
  ADD COLUMN "warehouse_id" UUID;

ALTER TABLE "sales_order_lines" ADD COLUMN "warehouse_id" UUID;

-- Preserve the original company-local document day; legacy orders retain
-- nullable term/warehouse fields and therefore their existing submit behavior.
UPDATE "sales_orders" AS so
SET "order_date" = (so."created_at" AT TIME ZONE c."timezone")::date,
    "salesperson_id" = so."created_by_id"
FROM "companies" AS c
WHERE c."id" = so."company_id";

ALTER TABLE "sales_orders"
  ALTER COLUMN "order_date" SET NOT NULL,
  -- Compatibility for older direct database inserts. Application commands
  -- explicitly resolve and persist the company-local day instead.
  ALTER COLUMN "order_date" SET DEFAULT CURRENT_DATE;

CREATE UNIQUE INDEX "warehouses_company_id_id_key" ON "warehouses"("company_id", "id");
CREATE INDEX "sales_orders_company_id_order_date_idx" ON "sales_orders"("company_id", "order_date");

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_salesperson_id_fkey"
    FOREIGN KEY ("salesperson_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "sales_orders_company_id_warehouse_id_fkey"
    FOREIGN KEY ("company_id", "warehouse_id") REFERENCES "warehouses"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_order_lines"
  ADD CONSTRAINT "sales_order_lines_company_id_warehouse_id_fkey"
    FOREIGN KEY ("company_id", "warehouse_id") REFERENCES "warehouses"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
