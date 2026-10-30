ALTER TABLE sales_invoices ADD COLUMN invoice_date date,
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN notes text;
ALTER TABLE sales_invoices ADD CONSTRAINT sales_invoice_version_positive CHECK (version > 0);
CREATE INDEX sales_invoice_company_date_idx ON sales_invoices(company_id, invoice_date, id);
-- No historical due dates, posted amounts or snapshots are rewritten.
