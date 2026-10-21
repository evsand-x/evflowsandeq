ALTER TABLE supplier_invoices ADD COLUMN tax_snapshot JSONB;
CREATE TABLE operational_taxes (
 id UUID PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id), name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('PPN','PPH')), effect TEXT NOT NULL CHECK (effect IN ('ADD','DEDUCT')),
 account_id UUID NOT NULL REFERENCES finance_accounts(id), percentage NUMERIC(12,8) NOT NULL CHECK (percentage BETWEEN 0 AND 100),
 decimal_places INTEGER NOT NULL CHECK (decimal_places BETWEEN 0 AND 8), rounding TEXT NOT NULL CHECK (rounding IN ('HALF_UP','HALF_EVEN','DOWN')),
 active BOOLEAN NOT NULL DEFAULT true, version INTEGER NOT NULL DEFAULT 1, effective_from TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(company_id,name)
);
CREATE TABLE operational_tax_revisions (
 id UUID PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id), tax_id UUID NOT NULL REFERENCES operational_taxes(id),
 version INTEGER NOT NULL, snapshot JSONB NOT NULL, actor_id UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(tax_id,version)
);
CREATE TABLE operational_tax_invoices (
 id UUID PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id), direction TEXT NOT NULL CHECK(direction IN ('OUTPUT','INPUT')),
 source_id UUID NOT NULL, party_id UUID NOT NULL, number TEXT NOT NULL, document_date DATE NOT NULL,
 evidence_id UUID NOT NULL REFERENCES transaction_evidence(id), version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL,
 UNIQUE(company_id,direction,source_id), UNIQUE(company_id,direction,party_id,number)
);
INSERT INTO permissions(id,code,resource,action,description)
SELECT gen_random_uuid(), resource || '.' || action, resource, action, 'Pajak operasional: izin submenu independen'
FROM (VALUES ('tax_master','read'),('tax_master','create'),('tax_master','update'),('tax_output','read'),('tax_output','update'),('tax_input','read'),('tax_input','update')) AS p(resource,action)
ON CONFLICT(code) DO NOTHING;
