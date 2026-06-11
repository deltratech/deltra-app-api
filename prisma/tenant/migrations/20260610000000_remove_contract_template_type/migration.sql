-- Remove contract "type" classification entirely.
-- Drops the template_type columns (and their indexes) from teacher_contracts and
-- teacher_contract_templates, then drops the now-unused enum type.

-- DropIndex (auto-named by Prisma on the dropped columns; guarded for safety)
DROP INDEX IF EXISTS "teacher_contracts_template_type_idx";
DROP INDEX IF EXISTS "teacher_contract_templates_template_type_is_active_idx";

-- AlterTable
ALTER TABLE "teacher_contracts" DROP COLUMN IF EXISTS "template_type";
ALTER TABLE "teacher_contract_templates" DROP COLUMN IF EXISTS "template_type";

-- CreateIndex (replacement index on templates without the type)
CREATE INDEX IF NOT EXISTS "teacher_contract_templates_is_active_idx" ON "teacher_contract_templates"("is_active");

-- DropEnum
DROP TYPE IF EXISTS "teacher_contract_template_type";
