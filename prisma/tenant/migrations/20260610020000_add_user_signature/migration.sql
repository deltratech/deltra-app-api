-- Reusable signature for a user (e.g. the principal), base64 PNG data URL.
ALTER TABLE "users" ADD COLUMN "signature_data" TEXT;
