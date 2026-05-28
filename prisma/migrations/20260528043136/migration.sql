/*
  Warnings:

  - The values [trial] on the enum `tenant_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "tenant_status_new" AS ENUM ('active', 'inactive', 'suspended');
ALTER TYPE "tenant_status" RENAME TO "tenant_status_old";
ALTER TYPE "tenant_status_new" RENAME TO "tenant_status";
DROP TYPE "public"."tenant_status_old";
COMMIT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "status" "tenant_status" NOT NULL DEFAULT 'active';
