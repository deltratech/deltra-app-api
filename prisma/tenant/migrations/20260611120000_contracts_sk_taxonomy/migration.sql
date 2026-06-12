ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'kontrak_guru_pkwt';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'kontrak_staff';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'pkwtt';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'perpanjangan_kontrak';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'sk_staff_tetap';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'sk_staff_kontrak';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'sk_koordinator_kurikulum';

ALTER TABLE "teacher_contracts" ALTER COLUMN "teacher_profile_id" DROP NOT NULL;
ALTER TABLE "teacher_contracts" ALTER COLUMN "contract_end_date" DROP NOT NULL;
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "recipient_user_id" UUID;

CREATE INDEX IF NOT EXISTS "teacher_contracts_recipient_user_id_idx" ON "teacher_contracts"("recipient_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_contracts_recipient_user_id_fkey'
  ) THEN
    ALTER TABLE "teacher_contracts"
      ADD CONSTRAINT "teacher_contracts_recipient_user_id_fkey"
      FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
