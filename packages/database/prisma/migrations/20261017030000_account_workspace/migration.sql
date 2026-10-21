ALTER TABLE finance_accounts
 ADD COLUMN category_label TEXT,
 ADD COLUMN description TEXT,
 ADD COLUMN parent_id UUID REFERENCES finance_accounts(id),
 ADD COLUMN account_type TEXT NOT NULL DEFAULT 'DETAIL' CHECK(account_type IN ('HEADER','DETAIL')),
 ADD COLUMN normal_balance TEXT NOT NULL DEFAULT 'DEBIT' CHECK(normal_balance IN ('DEBIT','CREDIT')),
 ADD COLUMN psak118_category TEXT,
 ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
UPDATE finance_accounts SET normal_balance='CREDIT' WHERE category IN ('LIABILITY','EQUITY','REVENUE');
CREATE INDEX finance_accounts_parent_idx ON finance_accounts(company_id,parent_id);
INSERT INTO permissions(id,code,resource,action,description)
SELECT gen_random_uuid(), 'account.' || action, 'account', action, 'Pengelolaan master akun'
FROM (VALUES ('read'),('create'),('update'),('import')) AS p(action)
ON CONFLICT(code) DO NOTHING;
