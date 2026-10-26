INSERT INTO permissions(id,code,resource,action,description)
VALUES(gen_random_uuid(),'sales_order.print','sales_order','print','Print Sales Order') ON CONFLICT DO NOTHING;
WITH granted AS (
 INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),rp.company_id,rp.role_id,np.id,rp.scope_type,rp.scope_id
 FROM role_permissions rp JOIN permissions op ON op.id=rp.permission_id AND op.code='sales_order.read'
 CROSS JOIN permissions np WHERE np.code='sales_order.print'
 ON CONFLICT DO NOTHING RETURNING *
)
INSERT INTO audit_events(id,company_id,action,resource_type,resource_id,reason,metadata)
 SELECT gen_random_uuid(),company_id,'permission.migrated','role',role_id,'Preserve browser print access of sales_order.read holders',jsonb_build_object('migration','20261025210000_sales_order_print_permission','permission_id',permission_id,'scope_type',scope_type,'scope_id',scope_id) FROM granted;
