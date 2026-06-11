CREATE TABLE "academic_years" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "semester" SMALLINT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_years_label_semester_key"
ON "academic_years"("label", "semester");

WITH year_inputs AS (
  SELECT DISTINCT "academic_year" AS "label", "semester" FROM "classrooms"
  UNION
  SELECT DISTINCT "academic_year" AS "label", 1::SMALLINT AS "semester" FROM "period_templates"
  UNION
  SELECT DISTINCT "academic_year" AS "label", "semester" FROM "homeroom_assignments"
  UNION
  SELECT DISTINCT "academic_year" AS "label", "semester" FROM "schedules"
  UNION
  SELECT DISTINCT "academic_year" AS "label", "semester" FROM "schedule_requirements"
)
INSERT INTO "academic_years" (
  "label",
  "semester",
  "start_date",
  "end_date",
  "is_active",
  "updated_at"
)
SELECT
  "label",
  "semester",
  CASE
    WHEN "label" ~ '^[0-9]{4}/[0-9]{4}$'
      THEN to_date(split_part("label", '/', 1) || '-07-01', 'YYYY-MM-DD')
    ELSE CURRENT_DATE
  END,
  CASE
    WHEN "label" ~ '^[0-9]{4}/[0-9]{4}$'
      THEN to_date(split_part("label", '/', 2) || '-06-30', 'YYYY-MM-DD')
    ELSE CURRENT_DATE
  END,
  true,
  CURRENT_TIMESTAMP
FROM year_inputs
WHERE "label" IS NOT NULL
ON CONFLICT ("label", "semester") DO NOTHING;

ALTER TABLE "classrooms" ADD COLUMN "academic_year_id" UUID;
UPDATE "classrooms" c
SET "academic_year_id" = ay."id"
FROM "academic_years" ay
WHERE ay."label" = c."academic_year"
  AND ay."semester" = c."semester";
ALTER TABLE "classrooms" ALTER COLUMN "academic_year_id" SET NOT NULL;

ALTER TABLE "period_templates" ADD COLUMN "academic_year_id" UUID;
UPDATE "period_templates" pt
SET "academic_year_id" = ay."id"
FROM "academic_years" ay
WHERE ay."label" = pt."academic_year"
  AND ay."semester" = 1;
ALTER TABLE "period_templates" ALTER COLUMN "academic_year_id" SET NOT NULL;

ALTER TABLE "homeroom_assignments" ADD COLUMN "academic_year_id" UUID;
UPDATE "homeroom_assignments" ha
SET "academic_year_id" = ay."id"
FROM "academic_years" ay
WHERE ay."label" = ha."academic_year"
  AND ay."semester" = ha."semester";
ALTER TABLE "homeroom_assignments" ALTER COLUMN "academic_year_id" SET NOT NULL;

ALTER TABLE "schedules" ADD COLUMN "academic_year_id" UUID;
UPDATE "schedules" s
SET "academic_year_id" = ay."id"
FROM "academic_years" ay
WHERE ay."label" = s."academic_year"
  AND ay."semester" = s."semester";
ALTER TABLE "schedules" ALTER COLUMN "academic_year_id" SET NOT NULL;

ALTER TABLE "schedule_requirements" ADD COLUMN "academic_year_id" UUID;
UPDATE "schedule_requirements" sr
SET "academic_year_id" = ay."id"
FROM "academic_years" ay
WHERE ay."label" = sr."academic_year"
  AND ay."semester" = sr."semester";
ALTER TABLE "schedule_requirements" ALTER COLUMN "academic_year_id" SET NOT NULL;

ALTER TABLE "attendance_records" ADD COLUMN "academic_year_id" UUID;
ALTER TABLE "attendance_records" ADD COLUMN "schedule_entry_id" UUID;
ALTER TABLE "attendance_records" ADD COLUMN "late_minutes" INTEGER;
ALTER TABLE "attendance_records" ADD COLUMN "updated_by_user_id" UUID;
ALTER TABLE "attendance_records" ADD COLUMN "update_reason" TEXT;

UPDATE "attendance_records" ar
SET "academic_year_id" = c."academic_year_id"
FROM "classrooms" c
WHERE c."id" = ar."classroom_id";
ALTER TABLE "attendance_records" ALTER COLUMN "academic_year_id" SET NOT NULL;

DROP INDEX IF EXISTS "classrooms_name_academic_year_semester_key";
DROP INDEX IF EXISTS "period_templates_grade_level_academic_year_key";
DROP INDEX IF EXISTS "homeroom_assignments_classroom_id_academic_year_semester_idx";
DROP INDEX IF EXISTS "schedules_classroom_id_academic_year_semester_key";
DROP INDEX IF EXISTS "schedule_requirements_classroom_id_subject_id_academic_year_key";
DROP INDEX IF EXISTS "attendance_records_student_profile_id_classroom_id_attendance__key";
DROP INDEX IF EXISTS "attendance_records_student_profile_id_attendance_date_idx";

CREATE UNIQUE INDEX "classrooms_name_academic_year_id_key"
ON "classrooms"("name", "academic_year_id");

CREATE UNIQUE INDEX "period_templates_grade_level_academic_year_id_key"
ON "period_templates"("grade_level", "academic_year_id");

CREATE INDEX "homeroom_assignments_classroom_id_academic_year_id_idx"
ON "homeroom_assignments"("classroom_id", "academic_year_id");

CREATE UNIQUE INDEX "schedules_classroom_id_academic_year_id_key"
ON "schedules"("classroom_id", "academic_year_id");

CREATE UNIQUE INDEX "schedule_requirements_classroom_id_subject_id_academic_year_id_semester_key"
ON "schedule_requirements"("classroom_id", "subject_id", "academic_year_id", "semester");

CREATE UNIQUE INDEX "attendance_records_student_profile_id_attendance_date_schedule_entry_id_key"
ON "attendance_records"("student_profile_id", "attendance_date", "schedule_entry_id");

CREATE INDEX "attendance_records_student_profile_id_academic_year_id_idx"
ON "attendance_records"("student_profile_id", "academic_year_id");

ALTER TABLE "classrooms"
ADD CONSTRAINT "classrooms_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "period_templates"
ADD CONSTRAINT "period_templates_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "homeroom_assignments"
ADD CONSTRAINT "homeroom_assignments_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedules"
ADD CONSTRAINT "schedules_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_requirements"
ADD CONSTRAINT "schedule_requirements_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_records"
ADD CONSTRAINT "attendance_records_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_records"
ADD CONSTRAINT "attendance_records_schedule_entry_id_fkey"
FOREIGN KEY ("schedule_entry_id") REFERENCES "schedule_entries"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_records"
ADD CONSTRAINT "attendance_records_updated_by_user_id_fkey"
FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "classrooms" DROP COLUMN "academic_year";
ALTER TABLE "period_templates" DROP COLUMN "academic_year";
ALTER TABLE "homeroom_assignments" DROP COLUMN "academic_year";
ALTER TABLE "schedules" DROP COLUMN "academic_year";
ALTER TABLE "schedule_requirements" DROP COLUMN "academic_year";
