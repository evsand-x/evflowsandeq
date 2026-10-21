ALTER TABLE "company_memberships" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
CREATE INDEX "company_memberships_company_id_deleted_at_idx" ON "company_memberships"("company_id", "deleted_at");
