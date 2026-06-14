-- AlterTable
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "signatures_json" JSONB;
