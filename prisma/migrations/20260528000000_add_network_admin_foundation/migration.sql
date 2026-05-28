ALTER TYPE "platform_user_role" ADD VALUE IF NOT EXISTS 'network_admin';

ALTER TABLE "tenants"
ADD CONSTRAINT "tenants_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "tenants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_users"
ADD COLUMN "network_id" UUID;

ALTER TABLE "platform_users"
ADD CONSTRAINT "platform_users_network_id_fkey"
FOREIGN KEY ("network_id") REFERENCES "tenants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "foundation_policy_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "network_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "content" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "foundation_policy_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "foundation_policy_templates_network_id_category_is_active_idx"
ON "foundation_policy_templates"("network_id", "category", "is_active");

ALTER TABLE "foundation_policy_templates"
ADD CONSTRAINT "foundation_policy_templates_network_id_fkey"
FOREIGN KEY ("network_id") REFERENCES "tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "foundation_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "network_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resource_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "foundation_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "foundation_audit_logs_network_id_created_at_idx"
ON "foundation_audit_logs"("network_id", "created_at");

CREATE INDEX "foundation_audit_logs_actor_id_created_at_idx"
ON "foundation_audit_logs"("actor_id", "created_at");

ALTER TABLE "foundation_audit_logs"
ADD CONSTRAINT "foundation_audit_logs_network_id_fkey"
FOREIGN KEY ("network_id") REFERENCES "tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "foundation_audit_logs"
ADD CONSTRAINT "foundation_audit_logs_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "platform_users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
