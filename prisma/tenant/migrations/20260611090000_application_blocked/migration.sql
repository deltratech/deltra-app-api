-- Application "blocked"/on-hold impediment flag (idempotent)
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "blocked_at" TIMESTAMPTZ(6);
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "block_reason" TEXT;
