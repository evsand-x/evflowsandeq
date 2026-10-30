-- Follow-up to 20261024140000_customer_credit: make the customers whose effective payment policy
-- found no matching OPS-FLX-03 term visible. Their default_term_code stays NULL (limit, freeze and
-- grace were copied); until a credit editor picks a term, SO submission falls back to the
-- company's COD term. One audit row per company lists the affected customers and their old terms.

-- @unmapped-begin
DO $$
DECLARE affected integer;
BEGIN
  WITH effective AS (
    SELECT DISTINCT ON (p.customer_id) p.*
    FROM customer_payment_policies p
    WHERE p.active AND p.effective_from <= now()
    ORDER BY p.customer_id, p.effective_from DESC, p.created_at DESC, p.id ASC
  ), unmapped AS (
    SELECT c.company_id, c.id, e.mode::text AS mode, e.top_days
    FROM customers c
    JOIN effective e ON e.customer_id = c.id AND e.company_id = c.company_id
    WHERE c.default_term_code IS NULL
  ), recorded AS (
    INSERT INTO audit_events (id, company_id, action, resource_type, reason, metadata)
    SELECT gen_random_uuid(), u.company_id, 'customer_credit.term_unmapped', 'customer',
      'Termin lama tidak ada di daftar termin; pelanggan memakai termin COD sampai termin bawaan dipilih.',
      jsonb_build_object(
        'customer_ids', jsonb_agg(u.id ORDER BY u.id),
        'policies', jsonb_agg(
          jsonb_build_object('customer_id', u.id, 'mode', u.mode, 'top_days', u.top_days)
          ORDER BY u.id))
    FROM unmapped u
    GROUP BY u.company_id
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM unmapped;
  RAISE NOTICE 'customer_credit.term_unmapped: % customer(s) without a matching OPS-FLX-03 term', affected;
END $$;
-- @unmapped-end
