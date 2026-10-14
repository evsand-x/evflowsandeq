-- Milestone 0 foundation for APP-00/01, IAM-01/03/04/10, CFG-01/02/07, NFR-02/03/07/09.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."PolicyVersionState" AS ENUM ('ACTIVE', 'RETIRED');

CREATE TABLE "public"."companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo_object_key" TEXT,
    "tax_identity" TEXT,
    "base_currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Makassar',
    "fiscal_year_start_day" INTEGER NOT NULL DEFAULT 1,
    "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "companies_fiscal_year_start_day_check" CHECK ("fiscal_year_start_day" BETWEEN 1 AND 31),
    CONSTRAINT "companies_fiscal_year_start_month_check" CHECK ("fiscal_year_start_month" BETWEEN 1 AND 12)
);

CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mfa_reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."company_memberships" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."roles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."user_roles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" UUID,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."role_permissions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."auth_sessions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "session_family_id" UUID NOT NULL,
    "device_label" TEXT,
    "permission_version" BIGINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" TEXT,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_sessions_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE TABLE "public"."refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_token_id" UUID,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE TABLE "public"."audit_events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "before_hash" TEXT,
    "after_hash" TEXT,
    "request_id" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."system_policies" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "owner_domain" TEXT NOT NULL,
    "policy_group" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "unit" TEXT,
    "validation_schema" JSONB NOT NULL,
    "requires_reason" BOOLEAN NOT NULL DEFAULT false,
    "allows_future_effective" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "system_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."policy_versions" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "value_snapshot" JSONB NOT NULL,
    "state" "public"."PolicyVersionState" NOT NULL,
    "effective_from" TIMESTAMPTZ(6),
    "saved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saved_by_id" UUID NOT NULL,
    "retired_at" TIMESTAMPTZ(6),
    "reason" TEXT,
    "approval_reference" TEXT,
    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "policy_versions_version_no_check" CHECK ("version_no" > 0)
);

CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
CREATE INDEX "company_memberships_user_id_active_idx" ON "public"."company_memberships"("user_id", "active");
CREATE UNIQUE INDEX "company_memberships_company_id_user_id_key" ON "public"."company_memberships"("company_id", "user_id");
CREATE UNIQUE INDEX "company_memberships_company_id_id_key" ON "public"."company_memberships"("company_id", "id");
CREATE UNIQUE INDEX "roles_company_id_code_key" ON "public"."roles"("company_id", "code");
CREATE UNIQUE INDEX "roles_company_id_id_key" ON "public"."roles"("company_id", "id");
CREATE UNIQUE INDEX "permissions_code_key" ON "public"."permissions"("code");
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "public"."permissions"("resource", "action");
CREATE INDEX "user_roles_company_id_role_id_idx" ON "public"."user_roles"("company_id", "role_id");
CREATE UNIQUE INDEX "user_roles_membership_id_role_id_key" ON "public"."user_roles"("membership_id", "role_id");
CREATE INDEX "role_permissions_company_id_role_id_idx" ON "public"."role_permissions"("company_id", "role_id");
CREATE UNIQUE INDEX "role_permissions_role_permission_scope_key" ON "public"."role_permissions"("role_id", "permission_id", "scope_type", "scope_id") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX "auth_sessions_session_family_id_key" ON "public"."auth_sessions"("session_family_id");
CREATE INDEX "auth_sessions_membership_id_revoked_at_idx" ON "public"."auth_sessions"("membership_id", "revoked_at");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "public"."refresh_tokens"("token_hash");
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_token_id_key" ON "public"."refresh_tokens"("replaced_by_token_id");
CREATE INDEX "refresh_tokens_session_id_expires_at_idx" ON "public"."refresh_tokens"("session_id", "expires_at");
CREATE INDEX "audit_events_company_id_resource_type_resource_id_occurred__idx" ON "public"."audit_events"("company_id", "resource_type", "resource_id", "occurred_at");
CREATE UNIQUE INDEX "system_policies_company_id_code_key" ON "public"."system_policies"("company_id", "code");
CREATE INDEX "policy_versions_policy_id_state_effective_from_idx" ON "public"."policy_versions"("policy_id", "state", "effective_from");
CREATE UNIQUE INDEX "policy_versions_policy_id_version_no_key" ON "public"."policy_versions"("policy_id", "version_no");
CREATE UNIQUE INDEX "policy_versions_one_active_key" ON "public"."policy_versions"("policy_id") WHERE "state" = 'ACTIVE';

ALTER TABLE "public"."company_memberships" ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."company_memberships" ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_company_id_membership_id_fkey" FOREIGN KEY ("company_id", "membership_id") REFERENCES "public"."company_memberships"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_company_id_role_id_fkey" FOREIGN KEY ("company_id", "role_id") REFERENCES "public"."roles"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_company_id_role_id_fkey" FOREIGN KEY ("company_id", "role_id") REFERENCES "public"."roles"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_company_id_membership_id_fkey" FOREIGN KEY ("company_id", "membership_id") REFERENCES "public"."company_memberships"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "public"."refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."system_policies" ADD CONSTRAINT "system_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."policy_versions" ADD CONSTRAINT "policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."system_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."policy_versions" ADD CONSTRAINT "policy_versions_saved_by_id_fkey" FOREIGN KEY ("saved_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
