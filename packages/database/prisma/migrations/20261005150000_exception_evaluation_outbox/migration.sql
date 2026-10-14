CREATE TABLE sales_exception_evaluations (
  id uuid PRIMARY KEY REFERENCES sales_exception_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sales_order_id uuid NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_version integer NOT NULL CHECK (order_version > 0),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','PROCESSING','COMPLETED','BLOCKED')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX sales_exception_evaluations_pending ON sales_exception_evaluations(state, available_at);
