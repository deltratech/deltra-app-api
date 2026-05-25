/*
  Warnings:

  - You are about to drop the column `is_active` on the `platform_users` table. All the data in the column will be lost.
  - You are about to drop the column `is_super_admin` on the `platform_users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "platform_user_role" AS ENUM ('superadmin', 'staff');

-- CreateEnum
CREATE TYPE "platform_user_status" AS ENUM ('active', 'inactive', 'suspended');

-- AlterTable
ALTER TABLE "platform_users" DROP COLUMN "is_active",
DROP COLUMN "is_super_admin",
ADD COLUMN     "role" "platform_user_role" NOT NULL DEFAULT 'superadmin',
ADD COLUMN     "status" "platform_user_status" NOT NULL DEFAULT 'active';
