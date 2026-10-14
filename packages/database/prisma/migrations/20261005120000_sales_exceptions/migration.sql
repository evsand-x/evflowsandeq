-- AlterTable
ALTER TABLE "public"."transaction_approval_policies" ADD COLUMN     "allowed_reasons" JSONB,
ADD COLUMN     "grant_hours" INTEGER;

-- CreateTable
CREATE TABLE "public"."sales_exception_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "line_id" UUID,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "material_hash" TEXT NOT NULL,
    "amount_limit" DECIMAL(24,8) NOT NULL,
    "reasons" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "policy_snapshot" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "sales_exception_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_exception_requests_company_id_sales_order_id_kind_sta_idx" ON "public"."sales_exception_requests"("company_id", "sales_order_id", "kind", "state");

CREATE UNIQUE INDEX "sales_order_company_identity" ON sales_orders(company_id, id);
ALTER TABLE sales_exception_requests ADD CONSTRAINT exception_order_company_fk FOREIGN KEY(company_id, sales_order_id) REFERENCES sales_orders(company_id, id);
ALTER TABLE sales_exception_requests ADD CONSTRAINT exception_evidence_company_fk FOREIGN KEY(company_id, evidence_id) REFERENCES transaction_evidence(company_id, id);
ALTER TABLE sales_exception_requests ADD CONSTRAINT exception_actor_company_fk FOREIGN KEY(company_id, requester_id) REFERENCES company_memberships(company_id, user_id);
ALTER TABLE sales_exception_requests ADD CONSTRAINT exception_line_fk FOREIGN KEY(line_id) REFERENCES sales_order_lines(id);
ALTER TABLE sales_exception_requests ADD CONSTRAINT exception_amount_positive CHECK(amount_limit > 0);
ALTER TABLE sales_exception_requests ADD CONSTRAINT exception_kind_valid CHECK(kind IN ('SALES_ORDER_UNLOCK','SPECIAL_PRICE'));
ALTER TABLE sales_exception_requests ADD CONSTRAINT exception_state_valid CHECK(state IN ('SUBMITTED','APPROVED','REJECTED','REVISION_REQUIRED','CANCELLED','STALE','EXPIRED','SUPERSEDED'));
ALTER TABLE transaction_approval_policies ADD CONSTRAINT grant_duration_positive CHECK(grant_hours IS NULL OR grant_hours > 0);
INSERT INTO permissions(id, code, resource, action, description)
SELECT gen_random_uuid(), resource || '.' || action, resource, action, 'Scoped sales exception and backorder control'
FROM (VALUES ('sales_order.unlock','request'),('sales_order.unlock','approve'),('price_request','submit'),('price_request','approve'),('sales_order','reallocate')) AS capabilities(resource,action)
ON CONFLICT DO NOTHING;


