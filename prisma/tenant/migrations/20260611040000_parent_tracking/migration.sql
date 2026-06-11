-- Parent tracking portal: app public token + selected package, invoice payment-claim (idempotent)
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "public_token" TEXT;
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "selected_dev_fee_tier_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "admission_applications_public_token_key" ON "admission_applications"("public_token");
ALTER TABLE "admission_invoices" ADD COLUMN IF NOT EXISTS "payment_claimed_at" TIMESTAMPTZ(6);
