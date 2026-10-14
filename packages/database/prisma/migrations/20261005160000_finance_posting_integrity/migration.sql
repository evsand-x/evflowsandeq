-- Posted financial values cannot be edited in place. Corrections must create another source.
CREATE FUNCTION reject_posted_finance_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'POSTED_FINANCE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_journal_immutable BEFORE UPDATE ON finance_journals
FOR EACH ROW EXECUTE FUNCTION reject_posted_finance_update();
CREATE TRIGGER finance_journal_line_immutable BEFORE UPDATE ON finance_journal_lines
FOR EACH ROW EXECUTE FUNCTION reject_posted_finance_update();
CREATE TRIGGER posted_ledger_immutable BEFORE UPDATE ON ledger_entries
FOR EACH ROW WHEN (OLD.journal_id IS NOT NULL) EXECUTE FUNCTION reject_posted_finance_update();

-- Validate company ownership at the database boundary as well as in commands.
CREATE FUNCTION validate_finance_journal_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM finance_periods p WHERE p.id=NEW.period_id AND p.company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM finance_posting_profiles p WHERE p.id=NEW.profile_id AND p.company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM company_memberships m WHERE m.company_id=NEW.company_id AND m.user_id=NEW.actor_id)
  THEN RAISE EXCEPTION 'JOURNAL_COMPANY_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_journal_scope BEFORE INSERT ON finance_journals
FOR EACH ROW EXECUTE FUNCTION validate_finance_journal_scope();
CREATE FUNCTION validate_finance_line_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM finance_journals j WHERE j.id=NEW.journal_id AND j.company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM finance_accounts a WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id)
  THEN RAISE EXCEPTION 'JOURNAL_LINE_COMPANY_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_line_scope BEFORE INSERT ON finance_journal_lines
FOR EACH ROW EXECUTE FUNCTION validate_finance_line_scope();
CREATE FUNCTION validate_finance_journal_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
  target := CASE WHEN TG_TABLE_NAME='finance_journals' THEN NEW.id ELSE NEW.journal_id END;
  IF NOT EXISTS (SELECT 1 FROM finance_journal_lines WHERE journal_id=target)
    OR (SELECT SUM(debit-credit) FROM finance_journal_lines WHERE journal_id=target) <> 0
  THEN RAISE EXCEPTION 'JOURNAL_UNBALANCED' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER finance_journal_balance AFTER INSERT ON finance_journals
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_finance_journal_balance();
CREATE CONSTRAINT TRIGGER finance_line_balance AFTER INSERT ON finance_journal_lines
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_finance_journal_balance();
