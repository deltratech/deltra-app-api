/*
  Warnings:

  - You are about to drop the column `body` on the `teacher_contract_templates` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `teacher_contract_templates` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "teacher_contract_templates_code_key";

-- AlterTable
ALTER TABLE "teacher_contract_templates" DROP COLUMN "body",
DROP COLUMN "code";
