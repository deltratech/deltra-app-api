-- Admissions / PPDB module
-- Idempotent: safe to run whether or not objects already exist (e.g. created via `prisma db push`).

DO $$ BEGIN
  CREATE TYPE "admission_school_level" AS ENUM ('preschool', 'primary', 'secondary');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "admission_student_category" AS ENUM ('kf_student', 'non_kf', 'not_applicable');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "admission_kf_status_source" AS ENUM ('system_derived', 'manual_verified', 'unverified', 'not_applicable');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "admission_stage" AS ENUM ('applied', 'kf_pending', 'document_review', 'tested', 'passed', 'failed', 'offer_pending', 'accepted', 'enrolled', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "admission_doc_status" AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "admission_doc_type" AS ENUM ('kf_proof', 'birth_certificate', 'family_card', 'photo', 'test_result', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "admission_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_no" TEXT,
  "applicant_name" TEXT NOT NULL,
  "applicant_nik" TEXT,
  "birth_date" DATE,
  "gender" "gender",
  "guardian_name" TEXT,
  "guardian_phone" TEXT,
  "guardian_email" TEXT,
  "school_level" "admission_school_level" NOT NULL,
  "grade_label" TEXT NOT NULL,
  "academic_year" TEXT NOT NULL,
  "student_category" "admission_student_category" NOT NULL DEFAULT 'not_applicable',
  "kf_status_source" "admission_kf_status_source" NOT NULL DEFAULT 'not_applicable',
  "stage" "admission_stage" NOT NULL DEFAULT 'applied',
  "test_date" DATE,
  "test_score" SMALLINT,
  "result_date" DATE,
  "result_notes" TEXT,
  "enrolled_at" TIMESTAMPTZ(6),
  "student_profile_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_applications_stage_idx" ON "admission_applications"("stage");
CREATE INDEX IF NOT EXISTS "admission_applications_academic_year_school_level_idx" ON "admission_applications"("academic_year", "school_level");

CREATE TABLE IF NOT EXISTS "admission_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "document_type" "admission_doc_type" NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "status" "admission_doc_status" NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "verified_by_id" UUID,
  "verified_at" TIMESTAMPTZ(6),
  "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_documents_application_id_idx" ON "admission_documents"("application_id");

DO $$ BEGIN
  ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
