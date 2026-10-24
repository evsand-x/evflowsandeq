-- Stage 2b: Setting > Pemetaan Akun replaces Finance > Akuntansi > Pengaturan Jurnal Otomatis.
-- Roles holding posting_profile.read/manage keep the equivalent access (1:1, no widening).
INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),rp.company_id,rp.role_id,np.id,rp.scope_type,rp.scope_id
 FROM role_permissions rp
 JOIN permissions op ON op.id=rp.permission_id AND op.code IN ('posting_profile.read','posting_profile.manage')
 JOIN permissions np ON np.code='account_mapping.'||split_part(op.code,'.',2)
 ON CONFLICT DO NOTHING;
