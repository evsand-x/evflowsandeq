-- Default sales/purchase tax replaces per customer x product SalesTaxRule (stage 2b).
-- PPN is modelled as rate x DPP factor; existing taxes keep factor 1 (unchanged results).
ALTER TABLE operational_taxes
  ADD COLUMN dpp_factor DECIMAL(24,10) NOT NULL DEFAULT 1,
  ADD COLUMN is_default_sales BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_default_purchase BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE operational_taxes
  ADD CONSTRAINT operational_taxes_dpp_factor_range CHECK (dpp_factor > 0 AND dpp_factor <= 1);

-- At most one default per company for each direction.
CREATE UNIQUE INDEX operational_taxes_one_default_sales
  ON operational_taxes(company_id) WHERE is_default_sales;
CREATE UNIQUE INDEX operational_taxes_one_default_purchase
  ON operational_taxes(company_id) WHERE is_default_purchase;

-- The tax master moves to Setting > Pajak: roles keep exactly the access they had on the old
-- Finance tax master (read -> read, update -> update); nothing is widened.
INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),rp.company_id,rp.role_id,np.id,rp.scope_type,rp.scope_id
 FROM role_permissions rp
 JOIN permissions op ON op.id=rp.permission_id AND op.code IN ('tax_master.read','tax_master.update')
 JOIN permissions np ON np.code='tax_setting.'||op.action
 ON CONFLICT DO NOTHING;
