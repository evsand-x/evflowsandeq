-- OTC-18: discount in percent per SO line, applied to the SO value before PPN (Release 1: SO only).
ALTER TABLE "sales_order_lines"
  ADD COLUMN "discount_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD CONSTRAINT "sales_order_lines_discount_rate_range" CHECK ("discount_rate" >= 0 AND "discount_rate" <= 100);
