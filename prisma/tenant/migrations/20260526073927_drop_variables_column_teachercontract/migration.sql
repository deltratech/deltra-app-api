/*
  Warnings:

  - You are about to drop the column `pdf_url` on the `teacher_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `role_title` on the `teacher_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `teaching_hours_per_week` on the `teacher_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `variables_json` on the `teacher_contracts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "teacher_contracts" DROP COLUMN "pdf_url",
DROP COLUMN "role_title",
DROP COLUMN "teaching_hours_per_week",
DROP COLUMN "variables_json";
