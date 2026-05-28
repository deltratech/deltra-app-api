CREATE TABLE "homeroom_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "classroom_id" UUID NOT NULL,
  "teacher_profile_id" UUID NOT NULL,
  "academic_year" TEXT NOT NULL,
  "semester" SMALLINT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "homeroom_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homeroom_assignments_teacher_profile_id_is_active_idx"
ON "homeroom_assignments"("teacher_profile_id", "is_active");

CREATE INDEX "homeroom_assignments_classroom_id_academic_year_semester_idx"
ON "homeroom_assignments"("classroom_id", "academic_year", "semester");

CREATE UNIQUE INDEX "homeroom_assignments_one_active_per_classroom_idx"
ON "homeroom_assignments"("classroom_id")
WHERE "is_active" = true AND "deleted_at" IS NULL;

ALTER TABLE "homeroom_assignments"
ADD CONSTRAINT "homeroom_assignments_classroom_id_fkey"
FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "homeroom_assignments"
ADD CONSTRAINT "homeroom_assignments_teacher_profile_id_fkey"
FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
