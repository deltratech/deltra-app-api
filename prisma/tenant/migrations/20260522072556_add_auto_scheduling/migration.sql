/*
  Warnings:

  - The values [active] on the enum `schedule_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "schedule_status_new" AS ENUM ('draft', 'published', 'archived');
ALTER TABLE "schedules" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "schedules" ALTER COLUMN "status" TYPE "schedule_status_new" USING ("status"::text::"schedule_status_new");
ALTER TYPE "schedule_status" RENAME TO "schedule_status_old";
ALTER TYPE "schedule_status_new" RENAME TO "schedule_status";
DROP TYPE "schedule_status_old";
ALTER TABLE "schedules" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- CreateTable
CREATE TABLE "schedule_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "classroom_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "teacher_profile_id" UUID,
    "room_id" UUID,
    "sessions_per_week" SMALLINT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "semester" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "schedule_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_unavailability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teacher_profile_id" UUID NOT NULL,
    "day_of_week" "day_of_week" NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_unavailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_requirements_classroom_id_subject_id_academic_year_key" ON "schedule_requirements"("classroom_id", "subject_id", "academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_unavailability_teacher_profile_id_day_of_week_time__key" ON "teacher_unavailability"("teacher_profile_id", "day_of_week", "time_slot_id");

-- AddForeignKey
ALTER TABLE "schedule_requirements" ADD CONSTRAINT "schedule_requirements_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_requirements" ADD CONSTRAINT "schedule_requirements_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_requirements" ADD CONSTRAINT "schedule_requirements_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_requirements" ADD CONSTRAINT "schedule_requirements_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_unavailability" ADD CONSTRAINT "teacher_unavailability_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_unavailability" ADD CONSTRAINT "teacher_unavailability_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
