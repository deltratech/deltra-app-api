-- Manual payment instructions on the PPDB form (idempotent)
ALTER TABLE "ppdb_forms" ADD COLUMN IF NOT EXISTS "payment_instructions" TEXT;
