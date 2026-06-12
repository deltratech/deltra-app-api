-- Education levels a school offers + custom preschool sub-types (public TenantSettings).
-- Idempotent so it is safe alongside earlier `db push` state.
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "levels_offered"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "preschool_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
