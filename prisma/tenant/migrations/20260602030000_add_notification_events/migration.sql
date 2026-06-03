CREATE TYPE "notification_category" AS ENUM ('academic', 'announcement', 'attendance', 'finance', 'document', 'system');
CREATE TYPE "notification_priority" AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE "notification_source_type" AS ENUM ('schedule', 'announcement', 'attendance', 'invoice', 'contract', 'system');

ALTER TABLE "notifications"
  ADD COLUMN "category" "notification_category" NOT NULL DEFAULT 'system',
  ADD COLUMN "event_type" TEXT NOT NULL DEFAULT 'test',
  ADD COLUMN "priority" "notification_priority" NOT NULL DEFAULT 'normal',
  ADD COLUMN "source_type" "notification_source_type",
  ADD COLUMN "source_id" UUID;

CREATE UNIQUE INDEX "notifications_user_id_event_type_source_type_source_id_key"
  ON "notifications"("user_id", "event_type", "source_type", "source_id");
CREATE INDEX "notifications_category_priority_created_at_idx"
  ON "notifications"("category", "priority", "created_at");
CREATE INDEX "notifications_source_type_source_id_idx"
  ON "notifications"("source_type", "source_id");
