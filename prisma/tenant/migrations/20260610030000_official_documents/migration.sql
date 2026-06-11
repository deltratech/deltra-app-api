-- Generalize teacher contracts into official school documents (SK / Surat).

-- New enum: document categories
CREATE TYPE "document_category" AS ENUM (
  'sk_tugas_mengajar', 'sk_wali_kelas', 'sk_pembina_ekskul',
  'sk_wakasek', 'sk_koordinator', 'sk_kepala_sekolah',
  'sk_guru_tetap', 'sk_guru_kontrak',
  'surat_tugas', 'surat_mutasi', 'surat_keterangan_kerja'
);

-- Extend the status enum with the document workflow states
ALTER TYPE "teacher_contract_status" ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE "teacher_contract_status" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "teacher_contract_status" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "teacher_contract_status" ADD VALUE IF NOT EXISTS 'archived';

-- Document columns on teacher_contracts
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "category" "document_category";
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "recipient_type" TEXT;
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "payload_json" JSONB;
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "approver_user_id" UUID;
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(6);
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ(6);
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "reject_reason" TEXT;
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "signer_user_id" UUID;
CREATE INDEX IF NOT EXISTS "teacher_contracts_category_idx" ON "teacher_contracts"("category");

-- Category on templates
ALTER TABLE "teacher_contract_templates" ADD COLUMN IF NOT EXISTS "category" "document_category";
