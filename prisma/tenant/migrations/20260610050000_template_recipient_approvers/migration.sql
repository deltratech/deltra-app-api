-- Per-template recipient + approver-role config, surfaced/editable at generate time.
ALTER TABLE "teacher_contract_templates" ADD COLUMN IF NOT EXISTS "recipient_type" TEXT;
ALTER TABLE "teacher_contract_templates" ADD COLUMN IF NOT EXISTS "approver_roles_json" JSONB;
ALTER TABLE "teacher_contracts" ADD COLUMN IF NOT EXISTS "approver_roles_json" JSONB;
