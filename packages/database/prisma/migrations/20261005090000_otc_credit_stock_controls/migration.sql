ALTER TABLE "stock_lots" ADD COLUMN "quality_state" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "stock_lots" ADD COLUMN "quality_reason" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN "payment_snapshot" JSONB;
ALTER TABLE "customer_payment_policies" ADD COLUMN "past_due_grace_days" INTEGER;
ALTER TABLE "customer_payment_policies" ADD COLUMN "frozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customer_payment_policies" ADD COLUMN "freeze_reason" TEXT;

-- Existing stock remains pending review. No migration invents quality approval or a policy snapshot.
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lot_quality_state"
  CHECK (quality_state IN ('PENDING','AVAILABLE','HOLD','RECALL','QUARANTINE'));
-- NOT VALID preserves pre-existing exceptions for explicit reconciliation; new writes are protected.
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lot_nonnegative_available"
  CHECK (quantity_on_hand >= 0 AND quantity_reserved >= 0 AND quantity_reserved <= quantity_on_hand) NOT VALID;
ALTER TABLE "customer_payment_policies" ADD CONSTRAINT "payment_policy_grace_nonnegative"
  CHECK (past_due_grace_days IS NULL OR past_due_grace_days >= 0);
