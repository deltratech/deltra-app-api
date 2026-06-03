ALTER TABLE "notification_delivery_logs" DROP CONSTRAINT IF EXISTS "notification_delivery_logs_notification_id_fkey";
DROP INDEX IF EXISTS "notification_delivery_logs_notification_id_push_device_token_id_key";

DELETE FROM "notification_delivery_logs" WHERE "recipient_id" IS NULL;

ALTER TABLE "notification_delivery_logs" ALTER COLUMN "recipient_id" SET NOT NULL;
ALTER TABLE "notification_delivery_logs" DROP COLUMN IF EXISTS "notification_id";

DROP TABLE IF EXISTS "notifications";
