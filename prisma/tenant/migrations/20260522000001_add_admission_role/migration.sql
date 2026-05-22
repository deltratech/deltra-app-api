-- AlterEnum: add 'admission' value to user_role
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'admission';
