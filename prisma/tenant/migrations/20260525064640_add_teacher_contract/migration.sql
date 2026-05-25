/*
  Warnings:

  - You are about to drop the column `allowances_json` on the `teacher_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `base_salary` on the `teacher_contracts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "teacher_contracts" DROP COLUMN "allowances_json",
DROP COLUMN "base_salary";
