-- Editable defaults for existing companies; never overwrite a configured policy/version.
-- Companies without an active member are initialized by the normal provisioning command.
WITH definitions(code,name,value_type,default_value,validation) AS (
  VALUES
    ('OPS-FLX-10','Gudang bawaan penjualan','string','null'::jsonb,'{"type":["string","null"],"minLength":1}'::jsonb),
    ('OPS-FLX-11','Gudang per barang di Sales Order','boolean','false'::jsonb,'{"type":"boolean"}'::jsonb),
    ('OPS-FLX-12','No. SP pelanggan wajib di Sales Order','boolean','false'::jsonb,'{"type":"boolean"}'::jsonb),
    ('OPS-FLX-13','Lampiran wajib di Sales Order','boolean','false'::jsonb,'{"type":"boolean"}'::jsonb)
), company_actors AS (
  SELECT c.id company_id,member.user_id FROM companies c
  JOIN LATERAL (
    SELECT m.user_id FROM company_memberships m JOIN users u ON u.id=m.user_id
    WHERE m.company_id=c.id AND m.active AND m.deleted_at IS NULL AND u.active
    ORDER BY m.created_at,m.id LIMIT 1
  ) member ON true
), inserted AS (
  INSERT INTO system_policies(id,company_id,code,name,owner_domain,policy_group,scope,value_type,validation_schema,default_value_snapshot,updated_at)
  SELECT gen_random_uuid(),c.company_id,d.code,d.name,'administration','sales','company',d.value_type,d.validation,d.default_value,now()
  FROM company_actors c CROSS JOIN definitions d
  ON CONFLICT(company_id,code) DO NOTHING
  RETURNING id,company_id,code,default_value_snapshot
), versions AS (
  INSERT INTO policy_versions(id,policy_id,version_no,value_snapshot,state,saved_by_id,reason)
  SELECT gen_random_uuid(),i.id,1,i.default_value_snapshot,'ACTIVE',c.user_id,'System migration: editable SO defaults'
  FROM inserted i JOIN company_actors c ON c.company_id=i.company_id
  RETURNING policy_id
)
INSERT INTO audit_events(id,company_id,action,resource_type,resource_id,reason,metadata)
SELECT gen_random_uuid(),i.company_id,'operational_policy.defaults_migrated','system_policy',i.id,
  'System migration: editable SO defaults',jsonb_build_object('code',i.code,'default',i.default_value_snapshot,'migration','20261025110000_sales_order_policy_defaults')
FROM inserted i JOIN versions v ON v.policy_id=i.id;
