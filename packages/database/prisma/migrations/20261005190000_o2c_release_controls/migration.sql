ALTER TABLE sales_tax_rules ADD COLUMN state text NOT NULL DEFAULT 'ACTIVE';
CREATE TABLE document_number_rules(id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id),document_kind text NOT NULL,prefix text NOT NULL,digits integer NOT NULL CHECK(digits BETWEEN 1 AND 18),reset_yearly boolean NOT NULL,effective_from date NOT NULL,effective_to date NOT NULL,created_by_id uuid NOT NULL REFERENCES users(id),CHECK(effective_to>effective_from));
CREATE INDEX document_number_rules_company_id_document_kind_effective_from_idx ON document_number_rules(company_id,document_kind,effective_from);
ALTER TABLE customer_receipts ADD COLUMN refunded_amount numeric(24,8) NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount+unallocated_amount<=amount);
ALTER TABLE advance_taxes ADD COLUMN reversed_amount numeric(24,8) NOT NULL DEFAULT 0 CHECK(reversed_amount>=0 AND reversed_amount+applied_amount<=amount);
ALTER TABLE advance_tax_lines ADD COLUMN reversed_amount numeric(24,8) NOT NULL DEFAULT 0 CHECK(reversed_amount>=0 AND reversed_amount+applied_amount<=amount);
ALTER TABLE sales_tax_rules ALTER COLUMN state SET DEFAULT 'DRAFT';
ALTER TABLE sales_tax_rules ADD CONSTRAINT sales_tax_state CHECK(state IN ('DRAFT','ACTIVE','RETIRED'));
ALTER TABLE receipt_tax_rules ADD COLUMN state text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE receipt_tax_rules ALTER COLUMN state SET DEFAULT 'DRAFT';
ALTER TABLE receipt_tax_rules ADD CONSTRAINT receipt_tax_state CHECK(state IN ('DRAFT','ACTIVE','RETIRED'));
INSERT INTO permissions(id,code,resource,action,description)
 SELECT gen_random_uuid(),resource||'.'||action,resource,action,'O2C release controls'
 FROM (VALUES ('finance_period','close'),('finance_period','reopen'),('finance_period','approve'),
 ('sales_tax_rule','activate'),('sales_tax_rule','approve'),('numbering_rule','read'),('numbering_rule','manage')) AS caps(resource,action) ON CONFLICT DO NOTHING;
ALTER TABLE sales_order_lines ADD CONSTRAINT order_remaining_quantity_bounds CHECK(allocated_quantity+backorder_quantity+closed_quantity<=ordered_quantity) NOT VALID;
CREATE OR REPLACE FUNCTION validate_finance_journal_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text||':finance',0));
 IF NOT EXISTS(SELECT 1 FROM finance_periods p WHERE p.id=NEW.period_id AND p.company_id=NEW.company_id AND p.state='OPEN' AND NEW.business_date BETWEEN p.starts_on AND p.ends_on)
 OR NOT EXISTS(SELECT 1 FROM finance_posting_profiles p WHERE p.id=NEW.profile_id AND p.company_id=NEW.company_id)
 OR NOT EXISTS(SELECT 1 FROM company_memberships m WHERE m.company_id=NEW.company_id AND m.user_id=NEW.actor_id AND m.active)
 THEN RAISE EXCEPTION 'JOURNAL_COMPANY_OR_PERIOD_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

-- Calendar must be configured; no assumed working days or holidays.
UPDATE system_policies SET validation_schema='{"type":"object","required":["value","unit","expiry_action","working_weekdays","holidays","working_start","cutoff"],"properties":{"value":{"type":"integer","minimum":1},"unit":{"type":"string","enum":["business_hour","business_day"]},"expiry_action":{"type":"string","enum":["release_unpicked"]},"working_weekdays":{"type":"array","minItems":1,"items":{"type":"integer","minimum":0,"maximum":6}},"holidays":{"type":"array","items":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"}},"working_start":{"type":"string","pattern":"^([01]\\d|2[0-3]):[0-5]\\d$"},"cutoff":{"type":"string","pattern":"^([01]\\d|2[0-3]):[0-5]\\d$"}}}'::jsonb WHERE code='OPS-FIN-06';
