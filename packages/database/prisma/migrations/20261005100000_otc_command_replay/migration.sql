CREATE TABLE transaction_commands (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  route TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, actor_id, route, key)
);

ALTER TABLE sales_tax_rules ADD CONSTRAINT tax_rule_valid
  CHECK (rate >= 0 AND rate <= 1 AND dpp_factor > 0 AND decimal_places BETWEEN 0 AND 8 AND rounding IN ('HALF_UP','HALF_EVEN','DOWN') AND effective_to > effective_from);
ALTER TABLE sales_tax_rules ADD CONSTRAINT tax_rule_company_fk FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE sales_tax_rules ADD CONSTRAINT tax_rule_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE sales_tax_rules ADD CONSTRAINT tax_rule_product_fk FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE transaction_approval_policies ADD CONSTRAINT approval_policy_valid
  CHECK (maximum_amount > 0 AND effective_to > effective_from AND jsonb_array_length(steps) > 0);
ALTER TABLE transaction_approval_policies ADD CONSTRAINT approval_policy_company_fk FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE transaction_approval_actions ADD CONSTRAINT approval_action_policy_fk FOREIGN KEY (policy_id) REFERENCES transaction_approval_policies(id);
ALTER TABLE transaction_approval_actions ADD CONSTRAINT approval_action_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id);
