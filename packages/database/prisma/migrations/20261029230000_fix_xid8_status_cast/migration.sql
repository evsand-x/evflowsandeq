CREATE OR REPLACE FUNCTION validate_finance_line_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_xid bigint; xmin_value bigint; candidate bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM finance_journals j WHERE j.id=NEW.journal_id AND j.company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM finance_accounts a WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id)
  THEN RAISE EXCEPTION 'JOURNAL_LINE_COMPANY_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
  SELECT txid_current(), j.xmin::text::bigint INTO current_xid, xmin_value FROM finance_journals j WHERE j.id=NEW.journal_id;
  candidate := ((current_xid >> 32) << 32) + xmin_value;
  IF pg_xact_status(candidate::text::xid8) <> 'in progress'
     AND pg_xact_status((candidate - 4294967296)::text::xid8) <> 'in progress'
     AND pg_xact_status((candidate + 4294967296)::text::xid8) <> 'in progress'
  THEN RAISE EXCEPTION 'POSTED_FINANCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
