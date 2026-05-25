-- CreateEnum
CREATE TYPE "teacher_contract_template_type" AS ENUM ('guru_tetap', 'guru_honorer', 'staff');

-- CreateEnum
CREATE TYPE "teacher_contract_status" AS ENUM ('draft', 'pending_signature', 'active', 'expired', 'renewed');

-- CreateTable
CREATE TABLE "teacher_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teacher_profile_id" UUID NOT NULL,
    "template_type" "teacher_contract_template_type" NOT NULL,
    "status" "teacher_contract_status" NOT NULL DEFAULT 'draft',
    "contract_start_date" DATE NOT NULL,
    "contract_end_date" DATE NOT NULL,
    "role_title" TEXT,
    "employment_status" "employment_status",
    "teaching_hours_per_week" SMALLINT,
    "teaching_assignment_notes" TEXT,
    "base_salary" DECIMAL(14,2),
    "allowances_json" JSONB,
    "document_title" TEXT,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "place_of_signing" TEXT,
    "signed_at" DATE,
    "school_representative_name" TEXT,
    "school_representative_title" TEXT,
    "notes" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teacher_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_contracts_teacher_profile_id_idx" ON "teacher_contracts"("teacher_profile_id");

-- CreateIndex
CREATE INDEX "teacher_contracts_template_type_idx" ON "teacher_contracts"("template_type");

-- CreateIndex
CREATE INDEX "teacher_contracts_status_idx" ON "teacher_contracts"("status");

-- CreateIndex
CREATE INDEX "teacher_contracts_contract_start_date_contract_end_date_idx" ON "teacher_contracts"("contract_start_date", "contract_end_date");

-- AddForeignKey
ALTER TABLE "teacher_contracts" ADD CONSTRAINT "teacher_contracts_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
