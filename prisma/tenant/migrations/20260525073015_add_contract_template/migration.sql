-- AlterTable
ALTER TABLE "teacher_contracts" ADD COLUMN     "pdf_url" TEXT,
ADD COLUMN     "rendered_content" TEXT,
ADD COLUMN     "renewal_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "template_id" UUID,
ADD COLUMN     "variables_json" JSONB;

-- CreateTable
CREATE TABLE "teacher_contract_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_type" "teacher_contract_template_type" NOT NULL,
    "body" TEXT,
    "template_file_url" TEXT,
    "template_file_name" TEXT,
    "template_mime_type" TEXT,
    "template_size_bytes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teacher_contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_contract_templates_code_key" ON "teacher_contract_templates"("code");

-- CreateIndex
CREATE INDEX "teacher_contract_templates_template_type_is_active_idx" ON "teacher_contract_templates"("template_type", "is_active");

-- AddForeignKey
ALTER TABLE "teacher_contracts" ADD CONSTRAINT "teacher_contracts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "teacher_contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
