ALTER TABLE "sales_invoices" ADD COLUMN "delivery_note_id" UUID;
ALTER TABLE "sales_invoices"
  ADD CONSTRAINT "sales_invoices_delivery_note_fkey"
  FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "sales_invoices_company_delivery_note_key"
  ON "sales_invoices"("company_id", "delivery_note_id");
