-- Add transit reconciliation state to fulfillment allocations.
ALTER TYPE "public"."InventoryMovementKind" ADD VALUE 'RETURN_FROM_TRANSIT';

ALTER TABLE "public"."fulfillment_allocations"
  ADD COLUMN "in_transit_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0,
  ADD COLUMN "accepted_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0,
  ADD COLUMN "returned_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0;

ALTER TABLE "public"."delivery_receipt_lines"
  ADD COLUMN "returned_quantity" DECIMAL(24,10) NOT NULL DEFAULT 0;
