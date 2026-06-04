ALTER TYPE "notification_source_type" ADD VALUE IF NOT EXISTS 'academic_note';

CREATE TABLE "academic_notes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_profile_id" UUID NOT NULL,
  "teacher_profile_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "subject_id" UUID,
  "classroom_id" UUID,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "note_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visible_to_guardian" BOOLEAN NOT NULL DEFAULT true,
  "file_url" TEXT,
  "file_name" TEXT,
  "mime_type" TEXT,
  "size_bytes" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "academic_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "academic_notes_student_profile_id_note_date_idx" ON "academic_notes"("student_profile_id", "note_date");
CREATE INDEX "academic_notes_teacher_profile_id_note_date_idx" ON "academic_notes"("teacher_profile_id", "note_date");
CREATE INDEX "academic_notes_classroom_id_note_date_idx" ON "academic_notes"("classroom_id", "note_date");
CREATE INDEX "academic_notes_created_by_user_id_idx" ON "academic_notes"("created_by_user_id");

ALTER TABLE "academic_notes" ADD CONSTRAINT "academic_notes_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_notes" ADD CONSTRAINT "academic_notes_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic_notes" ADD CONSTRAINT "academic_notes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_notes" ADD CONSTRAINT "academic_notes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic_notes" ADD CONSTRAINT "academic_notes_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
