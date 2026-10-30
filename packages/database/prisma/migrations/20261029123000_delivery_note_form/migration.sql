ALTER TABLE "delivery_notes"
  ADD COLUMN "document_date" date,
  ADD COLUMN "ship_date" date,
  ADD COLUMN "warehouse_id" uuid,
  ADD COLUMN "carrier_name" text,
  ADD COLUMN "vehicle_number" text,
  ADD COLUMN "driver_name" text,
  ADD COLUMN "freight_amount" numeric(24,8);

ALTER TABLE "delivery_notes"
  ADD CONSTRAINT "delivery_notes_warehouse_fkey"
    FOREIGN KEY ("company_id", "warehouse_id") REFERENCES "warehouses"("company_id", "id") ON DELETE RESTRICT,
  ADD CONSTRAINT "delivery_notes_freight_nonnegative_check"
    CHECK ("freight_amount" IS NULL OR "freight_amount" >= 0);

CREATE INDEX "delivery_notes_company_warehouse_state_idx"
  ON "delivery_notes"("company_id", "warehouse_id", "state");
