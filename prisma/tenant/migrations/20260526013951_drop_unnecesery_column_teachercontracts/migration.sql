/*
  Warnings:

  - You are about to drop the column `place_of_signing` on the `teacher_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `school_representative_name` on the `teacher_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `school_representative_title` on the `teacher_contracts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "teacher_contracts" DROP COLUMN "place_of_signing",
DROP COLUMN "school_representative_name",
DROP COLUMN "school_representative_title",
ADD COLUMN     "e_signature" TEXT;
