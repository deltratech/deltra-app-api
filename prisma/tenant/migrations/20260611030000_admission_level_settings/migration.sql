-- Per-school-level admission settings (idempotent)
CREATE TABLE IF NOT EXISTS "admission_level_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_level" "admission_school_level" NOT NULL,
  "has_test_gate" BOOLEAN NOT NULL DEFAULT true,
  "enrollment_cutoff" DATE,
  "grade_labels" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "admission_level_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admission_level_settings_school_level_key" ON "admission_level_settings"("school_level");
