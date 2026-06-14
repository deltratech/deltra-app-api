-- Remove the deprecated 'finance' value from the user_role enum.
-- Only users.role uses this type and no rows reference 'finance' (verified),
-- so a clean enum recreation is safe. Written portably (no schema-qualified
-- names) so it applies to every tenant schema via `npm run migrate:tenants`.
ALTER TYPE "user_role" RENAME TO "user_role_old";

CREATE TYPE "user_role" AS ENUM (
  'school_admin', 'network_admin', 'principal', 'teacher', 'student', 'parent', 'admission'
);

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "user_role" USING ("role"::text::"user_role");

DROP TYPE "user_role_old";
