ALTER TYPE "PolicyVersionState" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TABLE "companies"
  ADD COLUMN "profile_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "users"
  ADD COLUMN "password_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "system_policies"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "default_value_snapshot" JSONB;

UPDATE "system_policies"
SET
  "name" = "code",
  "default_value_snapshot" = '{}'::jsonb
WHERE "name" IS NULL OR "default_value_snapshot" IS NULL;

ALTER TABLE "system_policies"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "default_value_snapshot" SET NOT NULL;

CREATE UNIQUE INDEX "role_permissions_scope_unique"
  ON "role_permissions" (
    "role_id",
    "permission_id",
    "scope_type",
    COALESCE("scope_id", '00000000-0000-0000-0000-000000000000'::uuid)
  );
