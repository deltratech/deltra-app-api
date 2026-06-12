-- PPDB form: custom link slug + header description (idempotent)
ALTER TABLE "ppdb_forms" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "ppdb_forms" ADD COLUMN IF NOT EXISTS "description" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ppdb_forms_slug_key" ON "ppdb_forms"("slug");
