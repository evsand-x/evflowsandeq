ALTER TYPE "FulfillmentState" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "SalesInvoiceState" ADD VALUE IF NOT EXISTS 'ISSUED_WAITING_POD';
ALTER TYPE "LedgerEntryKind" ADD VALUE IF NOT EXISTS 'INVENTORY_QUARANTINE';
ALTER TYPE "LedgerEntryKind" ADD VALUE IF NOT EXISTS 'BANK_ADJUSTMENT';
ALTER TABLE sales_order_lines ADD COLUMN closed_quantity numeric(24,10) NOT NULL DEFAULT 0 CHECK(closed_quantity>=0);
ALTER TABLE sales_orders ADD COLUMN material_revision integer NOT NULL DEFAULT 1;
ALTER TABLE fulfillment_batches ADD COLUMN reservation_expires_at timestamptz, ADD COLUMN reservation_snapshot jsonb;
ALTER TABLE pick_lists ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE sales_exception_evaluations DROP CONSTRAINT sales_exception_evaluations_id_fkey;
ALTER TABLE fulfillment_allocations ADD COLUMN dispatch_unit_cost numeric(24,8);
UPDATE fulfillment_allocations a SET dispatch_unit_cost=m.unit_cost
 FROM inventory_movements m WHERE m.source_type='FULFILLMENT' AND m.source_id=a.fulfillment_batch_id AND m.stock_lot_id=a.stock_lot_id AND m.kind='DISPATCH';
ALTER TABLE sales_invoices ALTER COLUMN delivery_receipt_id DROP NOT NULL, ALTER COLUMN due_date DROP NOT NULL,
 ADD COLUMN fulfillment_batch_id uuid REFERENCES fulfillment_batches(id), ADD COLUMN issued_snapshot jsonb;
CREATE UNIQUE INDEX invoice_waiting_batch ON sales_invoices(company_id,fulfillment_batch_id) WHERE posted_at IS NULL AND fulfillment_batch_id IS NOT NULL;
DROP INDEX sales_invoices_delivery_receipt_id_key;
CREATE INDEX sales_invoices_delivery_receipt_id_idx ON sales_invoices(delivery_receipt_id);
CREATE UNIQUE INDEX invoice_posted_pod ON sales_invoices(delivery_receipt_id) WHERE state='POSTED';
ALTER TABLE credit_notes ADD COLUMN tax_amount numeric(24,8) NOT NULL DEFAULT 0 CHECK(tax_amount>=0);
ALTER TABLE customer_refunds ADD COLUMN bank_account_id uuid REFERENCES finance_bank_accounts(id),
 ADD COLUMN evidence_id uuid REFERENCES transaction_evidence(id), ADD COLUMN bank_reference text, ADD COLUMN currency char(3);
ALTER TABLE bank_statement_matches ALTER COLUMN receipt_id DROP NOT NULL,
 ADD COLUMN journal_line_id uuid REFERENCES finance_journal_lines(id), ADD COLUMN reversed_at timestamptz;
ALTER TABLE bank_statement_matches ADD CONSTRAINT bank_match_source_required CHECK(receipt_id IS NOT NULL OR journal_line_id IS NOT NULL);
UPDATE bank_statement_matches m SET journal_line_id=l.id FROM finance_journal_lines l JOIN finance_journals j ON j.id=l.journal_id
 WHERE m.receipt_id=j.source_id AND m.company_id=j.company_id AND j.source_type='CUSTOMER_RECEIPT' AND l.ledger_kind='CASH_RECEIPT';
CREATE TABLE advance_tax_lines (
 id uuid PRIMARY KEY, advance_tax_id uuid NOT NULL REFERENCES advance_taxes(id) ON DELETE RESTRICT,
 allocation_id uuid NOT NULL REFERENCES fulfillment_allocations(id), amount numeric(24,8) NOT NULL CHECK(amount>=0),
 applied_amount numeric(24,8) NOT NULL DEFAULT 0 CHECK(applied_amount>=0 AND applied_amount<=amount),
 UNIQUE(advance_tax_id,allocation_id)
);
-- Legacy aggregate advance taxes require explicit reconciliation, never guessed allocation.
CREATE TABLE o2c_control_events (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), source_type text NOT NULL,
 source_id uuid NOT NULL, kind text NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX o2c_control_events_company_id_source_type_source_id_idx ON o2c_control_events(company_id,source_type,source_id);
CREATE FUNCTION reject_posted_finance_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'POSTED_FINANCE_IMMUTABLE' USING ERRCODE='23514'; END $$;
CREATE TRIGGER finance_journal_no_delete BEFORE DELETE ON finance_journals FOR EACH ROW EXECUTE FUNCTION reject_posted_finance_delete();
CREATE TRIGGER finance_line_no_delete BEFORE DELETE ON finance_journal_lines FOR EACH ROW EXECUTE FUNCTION reject_posted_finance_delete();
CREATE TRIGGER posted_ledger_no_delete BEFORE DELETE ON ledger_entries FOR EACH ROW WHEN (OLD.journal_id IS NOT NULL) EXECUTE FUNCTION reject_posted_finance_delete();
CREATE TRIGGER o2c_event_no_delete BEFORE DELETE ON o2c_control_events FOR EACH ROW EXECUTE FUNCTION reject_posted_finance_delete();
CREATE TRIGGER o2c_event_no_update BEFORE UPDATE ON o2c_control_events FOR EACH ROW EXECUTE FUNCTION reject_posted_finance_update();
INSERT INTO permissions(id,code,resource,action,description)
 SELECT gen_random_uuid(),resource||'.'||action,resource,action,'O2C controlled recovery'
 FROM (VALUES ('fulfillment','release'),('sales_order','close_remainder'),('sales_invoice','issue'),
 ('bank_reconciliation','unmatch'),('bank_reconciliation','reopen'),('bank_transaction','create'),('bank_transaction','approve'),('bank_transaction','post'),
 ('customer_refund','create'),('customer_refund','approve'),('journal.reverse','approve'),('sales_order','update'),
 ('tax_correction','create'),('tax_correction','verify'),('tax_correction','post'),('journal','reverse')) AS caps(resource,action)
 ON CONFLICT DO NOTHING;
