ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'parent';

CREATE TYPE "push_device_platform" AS ENUM ('web');
CREATE TYPE "notification_delivery_status" AS ENUM ('queued', 'sent', 'failed');

ALTER TABLE "guardians" ADD COLUMN "user_id" UUID;
ALTER TABLE "announcement_recipients" ADD COLUMN "user_id" UUID;

CREATE TABLE "push_device_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "platform" "push_device_platform" NOT NULL DEFAULT 'web',
  "user_agent" TEXT,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "push_device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "announcement_id" UUID,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_delivery_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notification_id" UUID NOT NULL,
  "push_device_token_id" UUID NOT NULL,
  "status" "notification_delivery_status" NOT NULL DEFAULT 'queued',
  "provider" TEXT NOT NULL DEFAULT 'fcm',
  "provider_message_id" TEXT,
  "error" TEXT,
  "sent_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guardians_user_id_idx" ON "guardians"("user_id");
CREATE INDEX "announcement_recipients_user_id_read_at_idx" ON "announcement_recipients"("user_id", "read_at");
CREATE UNIQUE INDEX "push_device_tokens_token_key" ON "push_device_tokens"("token");
CREATE INDEX "push_device_tokens_user_id_revoked_at_idx" ON "push_device_tokens"("user_id", "revoked_at");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_announcement_id_idx" ON "notifications"("announcement_id");
CREATE UNIQUE INDEX "notification_delivery_logs_notification_id_push_device_token_id_key" ON "notification_delivery_logs"("notification_id", "push_device_token_id");
CREATE INDEX "notification_delivery_logs_status_created_at_idx" ON "notification_delivery_logs"("status", "created_at");

ALTER TABLE "guardians" ADD CONSTRAINT "guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_push_device_token_id_fkey" FOREIGN KEY ("push_device_token_id") REFERENCES "push_device_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
