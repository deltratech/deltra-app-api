-- Public PPDB registration form (idempotent)
CREATE TABLE IF NOT EXISTS "ppdb_forms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token" TEXT NOT NULL,
  "academic_year" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "is_open" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "ppdb_forms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ppdb_forms_token_key" ON "ppdb_forms"("token");
