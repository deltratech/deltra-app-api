-- Drop the redundant `semester` columns. Each row's semester is now derived from
-- its AcademicYear (via academic_year_id), which is unique on (label, semester),
-- so storing semester on these child tables duplicated a fact already implied by
-- academic_year_id and could drift.

ALTER TABLE "classrooms" DROP COLUMN "semester";
ALTER TABLE "schedules" DROP COLUMN "semester";
ALTER TABLE "homeroom_assignments" DROP COLUMN "semester";

-- schedule_requirements had `semester` inside its composite unique index.
-- DROP COLUMN automatically drops any index that references the column, so the old
-- (classroom_id, subject_id, academic_year_id, semester) unique is removed here.
ALTER TABLE "schedule_requirements" DROP COLUMN "semester";

-- Recreate the uniqueness on the remaining columns. academic_year_id already encodes
-- the semester, so (classroom_id, subject_id, academic_year_id) is the correct grain.
-- Explicit short name avoids the 63-char identifier-truncation footgun.
CREATE UNIQUE INDEX "schedule_requirements_class_subject_year_key"
  ON "schedule_requirements" ("classroom_id", "subject_id", "academic_year_id");
