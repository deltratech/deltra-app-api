-- Acceptance letter: editable template + issued state (idempotent)
ALTER TABLE "ppdb_forms" ADD COLUMN IF NOT EXISTS "acceptance_letter" TEXT;
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "letter_issued_at" TIMESTAMPTZ(6);
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "letter_url" TEXT;
