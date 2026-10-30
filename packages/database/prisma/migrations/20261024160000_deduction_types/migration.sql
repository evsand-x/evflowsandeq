-- Stage 2b: Setting > Jenis Potongan (deductions a customer may withhold from a payment).
CREATE TABLE deduction_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  settle_account_id UUID NOT NULL REFERENCES finance_accounts(id),
  proof_type TEXT NOT NULL,
  proof_required BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deduction_types_proof_type CHECK (proof_type IN ('BUKTI_POTONG','SSP_NTPN','NONE')),
  CONSTRAINT deduction_types_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT deduction_types_proof_required_needs_type CHECK (NOT proof_required OR proof_type <> 'NONE')
);
CREATE UNIQUE INDEX deduction_types_company_id_name_key ON deduction_types(company_id, name);
CREATE UNIQUE INDEX deduction_types_company_lower_name ON deduction_types(company_id, lower(name));
CREATE INDEX deduction_types_company_active ON deduction_types(company_id, active);

-- Roles that managed the old tax rules (WAPU/PPh) keep the equivalent access here; nothing else is widened.
INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),rp.company_id,rp.role_id,np.id,rp.scope_type,rp.scope_id
 FROM role_permissions rp
 JOIN permissions op ON op.id=rp.permission_id AND op.code='sales_tax_rule.manage'
 JOIN permissions np ON np.code IN ('deduction_type.read','deduction_type.manage')
 ON CONFLICT DO NOTHING;
