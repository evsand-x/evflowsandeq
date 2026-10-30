-- Bank account setup used to ride on posting_profile.manage; it now has its own permission (1:1 grants, no widening).
INSERT INTO permissions(id,code,resource,action,description)
 VALUES (gen_random_uuid(),'bank_account.manage','bank_account','manage','Bank account setup') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),rp.company_id,rp.role_id,np.id,rp.scope_type,rp.scope_id
 FROM role_permissions rp
 JOIN permissions op ON op.id=rp.permission_id AND op.code='posting_profile.manage'
 JOIN permissions np ON np.code='bank_account.manage'
 ON CONFLICT DO NOTHING;
