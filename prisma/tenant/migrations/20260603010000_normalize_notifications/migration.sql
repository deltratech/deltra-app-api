CREATE TABLE "notification_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID,
  "category" "notification_category" NOT NULL DEFAULT 'system',
  "event_type" TEXT NOT NULL,
  "priority" "notification_priority" NOT NULL DEFAULT 'normal',
  "source_type" "notification_source_type",
  "source_id" UUID,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_recipients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notification_delivery_logs" ADD COLUMN "recipient_id" UUID;
ALTER TABLE "notification_delivery_logs" ALTER COLUMN "notification_id" DROP NOT NULL;

CREATE UNIQUE INDEX "notification_events_event_type_source_type_source_id_key"
  ON "notification_events"("event_type", "source_type", "source_id");
CREATE INDEX "notification_events_announcement_id_idx" ON "notification_events"("announcement_id");
CREATE INDEX "notification_events_category_priority_created_at_idx" ON "notification_events"("category", "priority", "created_at");
CREATE INDEX "notification_events_source_type_source_id_idx" ON "notification_events"("source_type", "source_id");
CREATE UNIQUE INDEX "notification_recipients_event_id_user_id_key" ON "notification_recipients"("event_id", "user_id");
CREATE INDEX "notification_recipients_user_id_read_at_created_at_idx" ON "notification_recipients"("user_id", "read_at", "created_at");
CREATE UNIQUE INDEX "notification_delivery_logs_recipient_id_push_device_token_id_key"
  ON "notification_delivery_logs"("recipient_id", "push_device_token_id");
CREATE INDEX "notification_delivery_logs_recipient_id_idx" ON "notification_delivery_logs"("recipient_id");

ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_announcement_id_fkey"
  FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "notification_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "notification_events" (
  "announcement_id",
  "category",
  "event_type",
  "priority",
  "source_type",
  "source_id",
  "title",
  "body",
  "data",
  "created_at",
  "updated_at"
)
SELECT DISTINCT ON ("event_type", "source_type", "source_id")
  "announcement_id",
  "category",
  "event_type",
  "priority",
  "source_type",
  "source_id",
  "title",
  "body",
  "data",
  MIN("created_at") OVER (PARTITION BY "event_type", "source_type", "source_id"),
  MAX("updated_at") OVER (PARTITION BY "event_type", "source_type", "source_id")
FROM "notifications"
WHERE "source_type" IS NOT NULL AND "source_id" IS NOT NULL
ORDER BY "event_type", "source_type", "source_id", "created_at" ASC
ON CONFLICT ("event_type", "source_type", "source_id") DO NOTHING;

INSERT INTO "notification_recipients" ("event_id", "user_id", "read_at", "created_at", "updated_at")
SELECT
  e."id",
  n."user_id",
  n."read_at",
  n."created_at",
  n."updated_at"
FROM "notifications" n
JOIN "notification_events" e
  ON e."event_type" = n."event_type"
  AND e."source_type" = n."source_type"
  AND e."source_id" = n."source_id"
WHERE n."source_type" IS NOT NULL AND n."source_id" IS NOT NULL
ON CONFLICT ("event_id", "user_id") DO NOTHING;

UPDATE "notification_delivery_logs" dl
SET "recipient_id" = nr."id"
FROM "notifications" n
JOIN "notification_events" e
  ON e."event_type" = n."event_type"
  AND e."source_type" = n."source_type"
  AND e."source_id" = n."source_id"
JOIN "notification_recipients" nr
  ON nr."event_id" = e."id"
  AND nr."user_id" = n."user_id"
WHERE dl."notification_id" = n."id";
