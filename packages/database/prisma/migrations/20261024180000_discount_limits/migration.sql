-- Discount limits (percent, 0-100): per role, per person (membership) and per product cap.
ALTER TABLE "roles" ADD COLUMN "discount_limit" DECIMAL(7,4);
ALTER TABLE "company_memberships" ADD COLUMN "discount_limit" DECIMAL(7,4);
ALTER TABLE "products" ADD COLUMN "discount_limit" DECIMAL(7,4);

ALTER TABLE "roles" ADD CONSTRAINT "roles_discount_limit_range" CHECK ("discount_limit" IS NULL OR ("discount_limit" >= 0 AND "discount_limit" <= 100));
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_discount_limit_range" CHECK ("discount_limit" IS NULL OR ("discount_limit" >= 0 AND "discount_limit" <= 100));
ALTER TABLE "products" ADD CONSTRAINT "products_discount_limit_range" CHECK ("discount_limit" IS NULL OR ("discount_limit" >= 0 AND "discount_limit" <= 100));

-- discount_limit.manage is granted to nobody here: Admin Sistem holds every permission by default.
