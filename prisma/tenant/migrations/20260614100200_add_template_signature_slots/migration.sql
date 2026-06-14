-- The contract_templates.signature_slots_json column existed in the Prisma
-- schema but was never created by a migration (schema was historically synced
-- via `prisma db push`). Add it so migration-tracked schemas match the model.
ALTER TABLE "contract_templates" ADD COLUMN IF NOT EXISTS "signature_slots_json" JSONB;
