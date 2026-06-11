-- PPDB form builder: form fields + required-document checklist, custom answers, doc requirement tag (idempotent)
ALTER TABLE "ppdb_forms" ADD COLUMN IF NOT EXISTS "fields_json" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ppdb_forms" ADD COLUMN IF NOT EXISTS "required_documents_json" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "form_data_json" JSONB;
ALTER TABLE "admission_documents" ADD COLUMN IF NOT EXISTS "requirement_key" TEXT;
ALTER TABLE "admission_documents" ADD COLUMN IF NOT EXISTS "label" TEXT;
