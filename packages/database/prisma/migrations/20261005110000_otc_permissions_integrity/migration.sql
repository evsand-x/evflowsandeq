-- Multiple partial allocations are separate immutable events; replay is controlled by transaction_commands.
DROP INDEX "customer_receipt_allocations_receipt_invoice_key";
CREATE INDEX "customer_receipt_allocations_receipt_id_invoice_id_idx" ON "customer_receipt_allocations"("receipt_id", "invoice_id");
ALTER TABLE "transaction_evidence" ADD CONSTRAINT "evidence_company_actor_fk" FOREIGN KEY ("company_id", "actor_id") REFERENCES "company_memberships"("company_id", "user_id");
CREATE UNIQUE INDEX "evidence_company_id_key" ON "transaction_evidence"("company_id", "id");
ALTER TABLE "sales_orders" ADD CONSTRAINT "order_evidence_company_fk" FOREIGN KEY ("company_id", "evidence_id") REFERENCES "transaction_evidence"("company_id", "id");
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "pod_evidence_company_fk" FOREIGN KEY ("company_id", "evidence_id") REFERENCES "transaction_evidence"("company_id", "id");
ALTER TABLE "customer_receipts" ADD CONSTRAINT "receipt_evidence_company_fk" FOREIGN KEY ("company_id", "evidence_id") REFERENCES "transaction_evidence"("company_id", "id");
ALTER TABLE "fulfillment_documents" ADD CONSTRAINT "document_company_actor_fk" FOREIGN KEY ("company_id", "issued_by_id") REFERENCES "company_memberships"("company_id", "user_id");
ALTER TABLE "fulfillment_documents" ADD CONSTRAINT "document_batch_fk" FOREIGN KEY ("batch_id") REFERENCES "fulfillment_batches"("id");
ALTER TABLE "customer_receipts" ADD CONSTRAINT "receipt_amount_bounds" CHECK (amount > 0 AND unallocated_amount >= 0 AND unallocated_amount <= amount) NOT VALID;
ALTER TABLE "sales_invoices" ADD CONSTRAINT "invoice_outstanding_bounds" CHECK (outstanding_amount >= 0 AND (total IS NULL OR outstanding_amount <= total)) NOT VALID;
ALTER TABLE "customer_receipt_allocations" ADD CONSTRAINT "allocation_amount_positive" CHECK (amount > 0) NOT VALID;
-- Register capabilities only; no user or role receives automatic grants.
INSERT INTO permissions (id, code, resource, action, description) SELECT gen_random_uuid(), resource || '.' || action, resource, action, 'OTC operational workflow'
FROM (VALUES
 ('sales_order','read'),('sales_order','create'),('sales_order','submit'),
 ('fulfillment','read'),('fulfillment','pick'),('fulfillment','check'),('fulfillment','dispatch'),
 ('delivery_receipt','read'),('delivery_receipt','confirm'),
 ('sales_invoice','read'),('sales_invoice','post'),
 ('customer_receipt','read'),('customer_receipt','post'),('customer_receipt','allocate'),
 ('customer.payment_policy','manage'),('inventory.quality','decide'),
 ('sales_tax_rule','manage'),('transaction_approval','manage'),('purchase_request','approve')
) AS capabilities(resource, action) ON CONFLICT DO NOTHING;
