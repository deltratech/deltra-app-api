-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('present', 'late', 'excused', 'sick', 'absent');

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_profile_id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "status" "attendance_status" NOT NULL,
    "notes" TEXT,
    "marked_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_student_profile_id_classroom_id_attendance__key" ON "attendance_records"("student_profile_id", "classroom_id", "attendance_date");

-- CreateIndex
CREATE INDEX "attendance_records_classroom_id_attendance_date_idx" ON "attendance_records"("classroom_id", "attendance_date");

-- CreateIndex
CREATE INDEX "attendance_records_student_profile_id_attendance_date_idx" ON "attendance_records"("student_profile_id", "attendance_date");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_user_id_fkey" FOREIGN KEY ("marked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
