/*
  Warnings:

  - You are about to drop the column `parent_email` on the `student_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `parent_name` on the `student_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `parent_phone` on the `student_profiles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nisn]` on the table `student_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nik]` on the table `student_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nik]` on the table `teacher_profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "teacher_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "employment_status" AS ENUM ('pns', 'p3k', 'tetap', 'honorer');

-- CreateEnum
CREATE TYPE "portfolio_type" AS ENUM ('project', 'extracurricular', 'certificate', 'personal_development', 'other');

-- CreateEnum
CREATE TYPE "achievement_category" AS ENUM ('academic', 'non_academic', 'sports', 'arts', 'organization', 'competition');

-- CreateEnum
CREATE TYPE "achievement_level" AS ENUM ('school', 'district', 'city', 'provincial', 'national', 'international');

-- AlterTable
ALTER TABLE "student_profiles" DROP COLUMN "parent_email",
DROP COLUMN "parent_name",
DROP COLUMN "parent_phone",
ADD COLUMN     "nik" TEXT;

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "birth_place" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employment_status" "employment_status",
ADD COLUMN     "gender" "gender",
ADD COLUMN     "nik" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "status" "teacher_status" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "guardians" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_profile_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_portfolios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "portfolio_type" NOT NULL,
    "description" TEXT,
    "subject_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portfolio_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_achievements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "achievement_category" NOT NULL,
    "level" "achievement_level",
    "description" TEXT,
    "organizer" TEXT,
    "event_name" TEXT,
    "achieved_at" DATE NOT NULL,
    "rank" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "achievement_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_nisn_key" ON "student_profiles"("nisn");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_nik_key" ON "student_profiles"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_nik_key" ON "teacher_profiles"("nik");

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_portfolios" ADD CONSTRAINT "student_portfolios_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_portfolios" ADD CONSTRAINT "student_portfolios_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_attachments" ADD CONSTRAINT "portfolio_attachments_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "student_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_attachments" ADD CONSTRAINT "achievement_attachments_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "student_achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
