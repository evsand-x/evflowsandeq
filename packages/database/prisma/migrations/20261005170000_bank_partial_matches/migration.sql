CREATE TABLE bank_statement_matches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id),
 statement_line_id uuid NOT NULL REFERENCES bank_statement_lines(id) ON DELETE RESTRICT,
 receipt_id uuid NOT NULL REFERENCES customer_receipts(id) ON DELETE RESTRICT,
 amount numeric(24,8) NOT NULL CHECK (amount > 0),
 actor_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_statement_matches_receipt ON bank_statement_matches(company_id,receipt_id);
CREATE INDEX bank_statement_matches_line ON bank_statement_matches(company_id,statement_line_id);
INSERT INTO bank_statement_matches(company_id,statement_line_id,receipt_id,amount,actor_id,created_at)
SELECT company_id,id,receipt_id,amount,matched_by_id,matched_at FROM bank_statement_lines WHERE receipt_id IS NOT NULL;
