-- Independent permission per Setting submenu (stage 2b).
INSERT INTO permissions(id,code,resource,action,description)
 SELECT gen_random_uuid(),resource||'.'||action,resource,action,'Setting submenu permission'
 FROM (VALUES ('setting_general','read'),('setting_general','update'),('tax_setting','read'),('tax_setting','update'),('terms_credit','read'),('terms_credit','update'),('deduction_type','read'),('deduction_type','manage'),('account_mapping','read'),('account_mapping','manage'),('customer_credit','update'),('discount_limit','manage'),('special_price','approve')) AS caps(resource,action) ON CONFLICT DO NOTHING;

-- Roles that held operational_policy.* keep the same access on the two submenus that exist today.
INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),rp.company_id,rp.role_id,np.id,rp.scope_type,rp.scope_id
 FROM role_permissions rp
 JOIN permissions op ON op.id=rp.permission_id AND op.code IN ('operational_policy.read','operational_policy.update')
 JOIN permissions np ON np.code IN (
  'setting_general.'||op.action,'terms_credit.'||op.action)
 ON CONFLICT DO NOTHING;
