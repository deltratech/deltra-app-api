-- Custom/modular admission stages: replace the AdmissionStage enum with a
-- configurable AdmissionStageDef table + role enum, and migrate
-- admission_applications.stage (enum) -> stage_key (text). Idempotent &
-- data-preserving (apply with `prisma db execute`, NOT plain db push).

-- 1. role enum
DO $$ BEGIN
  CREATE TYPE "admission_stage_role" AS ENUM ('entry','test','offer','accepted','enrolled','rejected','generic');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. stage-defs table
CREATE TABLE IF NOT EXISTS "admission_stage_defs" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"          TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "public_label" TEXT,
  "role"         "admission_stage_role" NOT NULL DEFAULT 'generic',
  "sort_order"   INTEGER NOT NULL DEFAULT 0,
  "color"        TEXT,
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "admission_stage_defs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admission_stage_defs_key_key" ON "admission_stage_defs" ("key");

-- 3. seed the default pipeline (simpler than the old enum; KF dropped)
INSERT INTO "admission_stage_defs" ("key","label","role","sort_order","color") VALUES
  ('applied','Applied','entry',10,'bg-slate-400'),
  ('test','Test','test',20,'bg-violet-400'),
  ('passed','Passed','generic',30,'bg-emerald-400'),
  ('payment','Payment','offer',40,'bg-amber-400'),
  ('enrolled','Enrolled','enrolled',50,'bg-sky-500'),
  ('rejected','Rejected','rejected',60,'bg-red-400')
ON CONFLICT ("key") DO NOTHING;

-- 4. application column: enum stage -> text stage_key (backfill while old col exists)
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "stage_key" TEXT NOT NULL DEFAULT 'applied';
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'admission_applications' AND column_name = 'stage'
  ) THEN
    UPDATE "admission_applications" SET "stage_key" = CASE "stage"::text
      WHEN 'tested'        THEN 'test'
      WHEN 'passed'        THEN 'passed'
      WHEN 'offer_pending' THEN 'payment'
      WHEN 'accepted'      THEN 'payment'
      WHEN 'enrolled'      THEN 'enrolled'
      WHEN 'failed'        THEN 'rejected'
      WHEN 'rejected'      THEN 'rejected'
      ELSE 'applied'  -- applied, kf_pending, document_review
    END;
    DROP INDEX IF EXISTS "admission_applications_stage_idx";
    ALTER TABLE "admission_applications" DROP COLUMN "stage";
  END IF;
END $$;

-- 5. drop the old enum type once unused
DO $$ BEGIN
  DROP TYPE IF EXISTS "admission_stage";
EXCEPTION WHEN dependent_objects_still_exist THEN null; END $$;

-- 6. index on the new column
CREATE INDEX IF NOT EXISTS "admission_applications_stage_key_idx" ON "admission_applications" ("stage_key");
