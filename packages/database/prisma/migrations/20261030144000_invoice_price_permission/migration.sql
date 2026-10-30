INSERT INTO permissions(id,code,resource,action,description)
VALUES(gen_random_uuid(),'sales_invoice.view_price','sales_invoice','view_price','Lihat harga dan nilai Invoice') ON CONFLICT DO NOTHING;
WITH candidates AS (
 SELECT DISTINCT rp.company_id,rp.role_id,np.id AS permission_id,rp.scope_type,rp.scope_id
 FROM role_permissions rp JOIN permissions op ON op.id=rp.permission_id
 CROSS JOIN permissions np
 WHERE op.code IN ('sales_invoice.read','sales_invoice.post','customer_receipt.read','customer_receipt.post')
 AND np.code='sales_invoice.view_price'
), granted AS (
 INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),c.company_id,c.role_id,c.permission_id,c.scope_type,c.scope_id FROM candidates c
 WHERE NOT EXISTS(SELECT 1 FROM role_permissions r WHERE r.role_id=c.role_id AND r.permission_id=c.permission_id
 AND r.scope_type=c.scope_type AND r.scope_id IS NOT DISTINCT FROM c.scope_id)
 ON CONFLICT DO NOTHING RETURNING *
)
INSERT INTO audit_events(id,company_id,action,resource_type,resource_id,reason,metadata)
SELECT gen_random_uuid(),company_id,'permission.migrated','role',role_id,
'Preserve existing invoice/payment amount access; no read or post grants added',
jsonb_build_object('migration','20261030144000_invoice_price_permission','permission_id',permission_id,'scope_type',scope_type,'scope_id',scope_id) FROM granted;
