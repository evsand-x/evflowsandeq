CREATE OR REPLACE FUNCTION validate_finance_journal_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
  target := (to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='finance_journals' THEN 'id' ELSE 'journal_id' END)::uuid;
  IF NOT EXISTS (SELECT 1 FROM finance_journal_lines WHERE journal_id=target)
    OR (SELECT SUM(debit-credit) FROM finance_journal_lines WHERE journal_id=target) <> 0
  THEN RAISE EXCEPTION 'JOURNAL_UNBALANCED' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
