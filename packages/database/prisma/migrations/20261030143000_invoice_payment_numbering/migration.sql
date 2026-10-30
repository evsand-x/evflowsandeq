-- Add editable receipt numbering only for companies with no existing rule.
WITH inserted AS (
 INSERT INTO document_number_rules (id,company_id,document_kind,prefix,digits,year_format,reset_period,effective_from,effective_to,created_by_id)
 SELECT gen_random_uuid(),c.id,'customer_receipt','RC',4,'YYYY','MONTHLY',DATE '2000-01-01',DATE '2999-12-31',m.user_id
 FROM companies c
 JOIN LATERAL (SELECT user_id FROM company_memberships WHERE company_id=c.id AND active=true ORDER BY created_at,id LIMIT 1) m ON true
 WHERE NOT EXISTS (SELECT 1 FROM document_number_rules r WHERE r.company_id=c.id AND r.document_kind='customer_receipt')
 RETURNING id,company_id
)
INSERT INTO audit_events (id,company_id,action,resource_type,resource_id,metadata)
SELECT gen_random_uuid(),company_id,'company_defaults.receipt_numbering_provisioned','numbering_rule',id,'{"migration":"20261030143000_invoice_payment_numbering","document_kind":"customer_receipt"}'::jsonb FROM inserted;
