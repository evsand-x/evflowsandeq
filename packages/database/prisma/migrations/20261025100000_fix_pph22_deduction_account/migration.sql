-- Stage 2b final review fixes.
-- 1) Default deduction "PPh 22" must settle to 1-10501 (PPh 22 prepaid), not 1-10502 (PPh 23).
--    Only rows never edited by a user (version = 1) are corrected.
UPDATE deduction_types dt
SET settle_account_id = good.id, updated_at = now()
FROM finance_accounts bad, finance_accounts good
WHERE dt.name = 'PPh 22'
  AND dt.version = 1
  AND bad.id = dt.settle_account_id
  AND bad.code = '1-10502'
  AND good.company_id = dt.company_id
  AND good.code = '1-10501'
  AND bad.company_id = dt.company_id;

-- 2) One concept, one field: the legacy customers.payment_tolerance_days is folded into
--    past_due_grace_days (the field the credit check reads). The column stays as an archive.
UPDATE customers
SET past_due_grace_days = payment_tolerance_days
WHERE past_due_grace_days IS NULL
  AND payment_tolerance_days IS NOT NULL;
