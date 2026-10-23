-- Columns present in schema.prisma but missing from migration history (previously added by db push).
ALTER TABLE "public"."goods_receipt_lines" ADD COLUMN     "prospectNeedId" UUID,
ADD COLUMN     "uomId" UUID;
ALTER TABLE "public"."purchase_order_lines" ADD COLUMN     "prospectNeedId" UUID,
ADD COLUMN     "uomId" UUID;
ALTER TABLE "public"."purchase_request_lines" ADD COLUMN     "prospectNeedId" UUID,
ADD COLUMN     "uomId" UUID;
ALTER TABLE "public"."sales_order_lines" ADD COLUMN     "prospectNeedId" UUID,
ADD COLUMN     "uomId" UUID;
ALTER TABLE "public"."stock_lots" ADD COLUMN     "prospectNeedId" UUID,
ADD COLUMN     "uomId" UUID;
ALTER TABLE "public"."stock_lots" ADD CONSTRAINT "stock_lots_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "public"."uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."stock_lots" ADD CONSTRAINT "stock_lots_prospectNeedId_fkey" FOREIGN KEY ("prospectNeedId") REFERENCES "public"."prospect_needs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "public"."uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_prospectNeedId_fkey" FOREIGN KEY ("prospectNeedId") REFERENCES "public"."prospect_needs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "public"."uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_prospectNeedId_fkey" FOREIGN KEY ("prospectNeedId") REFERENCES "public"."prospect_needs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "public"."uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_prospectNeedId_fkey" FOREIGN KEY ("prospectNeedId") REFERENCES "public"."prospect_needs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "public"."uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_prospectNeedId_fkey" FOREIGN KEY ("prospectNeedId") REFERENCES "public"."prospect_needs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
