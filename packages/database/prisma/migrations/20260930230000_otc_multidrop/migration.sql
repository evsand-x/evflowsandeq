ALTER TYPE "public"."FulfillmentState" ADD VALUE 'PARTIALLY_DELIVERED';
DROP INDEX IF EXISTS "delivery_receipts_fulfillment_batch_id_key";
