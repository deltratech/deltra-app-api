/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `platform_users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "platform_users" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_username_key" ON "platform_users"("username");
