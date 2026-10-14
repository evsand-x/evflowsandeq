CREATE OR REPLACE FUNCTION validate_finance_line_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM finance_journals j WHERE j.id=NEW.journal_id AND j.company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM finance_accounts a WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id)
  THEN RAISE EXCEPTION 'JOURNAL_LINE_COMPANY_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM finance_journals j WHERE j.id=NEW.journal_id AND j.xmin::text::bigint = txid_current() % 4294967296)
  THEN RAISE EXCEPTION 'POSTED_FINANCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
