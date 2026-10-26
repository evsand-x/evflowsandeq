CREATE TYPE "SalesOrderAdvanceState" AS ENUM ('PENDING_VERIFICATION','VERIFIED','REJECTED');
ALTER TABLE customer_receipts ADD COLUMN sales_order_id uuid REFERENCES sales_orders(id) ON DELETE RESTRICT;
CREATE INDEX customer_receipts_order_idx ON customer_receipts(company_id,sales_order_id,state);
CREATE TABLE sales_order_advances (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), sales_order_id uuid NOT NULL REFERENCES sales_orders(id),
 amount numeric(24,8) NOT NULL CHECK(amount > 0), currency char(3) NOT NULL,
 received_at timestamptz NOT NULL, bank_account_id uuid NOT NULL REFERENCES finance_bank_accounts(id), bank_reference text,
 evidence_id uuid NOT NULL REFERENCES transaction_evidence(id), state "SalesOrderAdvanceState" NOT NULL DEFAULT 'PENDING_VERIFICATION',
 recorded_by_id uuid NOT NULL REFERENCES users(id), recorded_at timestamptz NOT NULL DEFAULT now(),
 verified_by_id uuid REFERENCES users(id), verified_at timestamptz, rejection_reason text,
 customer_receipt_id uuid UNIQUE REFERENCES customer_receipts(id), version integer NOT NULL DEFAULT 1, idempotency_key text NOT NULL,
 CONSTRAINT advance_separate_verifier CHECK(verified_by_id IS NULL OR verified_by_id <> recorded_by_id),
 CONSTRAINT advance_verified_receipt CHECK((state='VERIFIED') = (customer_receipt_id IS NOT NULL)),
 CONSTRAINT advance_decision CHECK((state='PENDING_VERIFICATION' AND verified_by_id IS NULL AND verified_at IS NULL) OR (state<>'PENDING_VERIFICATION' AND verified_by_id IS NOT NULL AND verified_at IS NOT NULL)),
 CONSTRAINT advance_rejection_reason CHECK(state<>'REJECTED' OR length(trim(rejection_reason)) BETWEEN 1 AND 500),
 UNIQUE(company_id,idempotency_key)
);
CREATE INDEX sales_order_advances_company_id_sales_order_id_state_idx ON sales_order_advances(company_id,sales_order_id,state);
INSERT INTO permissions(id,code,resource,action,description)
 SELECT gen_random_uuid(),'sales_order_advance.'||action,'sales_order_advance',action,'SO advance '||action FROM (VALUES ('create'),('verify')) cap(action) ON CONFLICT DO NOTHING;
WITH granted AS (
 INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),rp.company_id,rp.role_id,np.id,rp.scope_type,rp.scope_id
 FROM role_permissions rp JOIN permissions op ON op.id=rp.permission_id AND op.code='customer_receipt.post'
 CROSS JOIN permissions np WHERE np.code IN ('sales_order_advance.create','sales_order_advance.verify')
 ON CONFLICT DO NOTHING RETURNING *
)
INSERT INTO audit_events(id,company_id,action,resource_type,resource_id,reason,metadata)
 SELECT gen_random_uuid(),company_id,'permission.migrated','role',role_id,'Preserve existing customer_receipt.post access for SO advances',jsonb_build_object('migration','20261025200000_sales_order_advance','permission_id',permission_id,'scope_type',scope_type,'scope_id',scope_id) FROM granted;
