-- Stage 2b: credit limit, freeze and past-due grace become customer attributes (Master Data >
-- Pelanggan). customer_payment_policies stays as a read-only archive; nothing writes it any more.
ALTER TABLE customers
  ADD COLUMN credit_limit DECIMAL(24,8),
  ADD COLUMN credit_frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN freeze_reason TEXT,
  ADD COLUMN past_due_grace_days INTEGER,
  ADD COLUMN default_term_code TEXT,
  ADD COLUMN default_tax_invoice_code CHAR(2) NOT NULL DEFAULT '01';
ALTER TABLE customers
  ADD CONSTRAINT customers_credit_limit_nonnegative
    CHECK (credit_limit IS NULL OR credit_limit >= 0),
  ADD CONSTRAINT customers_past_due_grace_days_nonnegative
    CHECK (past_due_grace_days IS NULL OR past_due_grace_days >= 0),
  ADD CONSTRAINT customers_freeze_reason_required
    CHECK (NOT credit_frozen OR coalesce(btrim(freeze_reason), '') <> ''),
  ADD CONSTRAINT customers_default_tax_invoice_code_range
    CHECK (default_tax_invoice_code IN ('01','02','03','04','05','06','07','08','09','10'));

-- @copy-begin
-- Copy each customer's currently effective payment policy (same ordering the credit check used).
-- The term code is the first entry of the company's active OPS-FLX-03 list with the same kind
-- (and, for TEMPO, the same number of days). No match leaves default_term_code NULL, which
-- blocks the SO with PAYMENT_POLICY_REQUIRED until a credit editor picks a term.
WITH effective AS (
  SELECT DISTINCT ON (p.customer_id) p.*
  FROM customer_payment_policies p
  WHERE p.active AND p.effective_from <= now()
  ORDER BY p.customer_id, p.effective_from DESC, p.created_at DESC, p.id ASC
), terms AS (
  SELECT s.company_id, t.value AS term, t.ordinality
  FROM system_policies s
  JOIN LATERAL (
    SELECT v.value_snapshot FROM policy_versions v
    WHERE v.policy_id = s.id AND v.state = 'ACTIVE'
    ORDER BY v.version_no DESC LIMIT 1
  ) v ON true
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(v.value_snapshot) = 'array' THEN v.value_snapshot ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS t(value, ordinality)
  WHERE s.code = 'OPS-FLX-03'
)
UPDATE customers c SET
  credit_limit = e.credit_limit,
  credit_frozen = e.frozen,
  freeze_reason = CASE
    WHEN e.frozen THEN coalesce(nullif(btrim(e.freeze_reason), ''), 'Dipindahkan dari kebijakan pembayaran lama')
    ELSE e.freeze_reason END,
  past_due_grace_days = e.past_due_grace_days,
  default_term_code = (
    SELECT tm.term->>'code' FROM terms tm
    WHERE tm.company_id = c.company_id
      AND tm.term->>'kind' = e.mode::text
      AND (e.mode::text <> 'TEMPO' OR (tm.term->>'days')::int = e.top_days)
    ORDER BY tm.ordinality LIMIT 1
  )
FROM effective e
WHERE e.customer_id = c.id AND e.company_id = c.company_id;
-- @copy-end

-- Roles that managed the customer payment policy now edit the customer credit attributes;
-- 1:1 with the same scope, nothing is widened.
INSERT INTO role_permissions(id,company_id,role_id,permission_id,scope_type,scope_id)
 SELECT gen_random_uuid(),rp.company_id,rp.role_id,np.id,rp.scope_type,rp.scope_id
 FROM role_permissions rp
 JOIN permissions op ON op.id=rp.permission_id AND op.code='customer.payment_policy.manage'
 JOIN permissions np ON np.code='customer_credit.update'
 ON CONFLICT DO NOTHING;
