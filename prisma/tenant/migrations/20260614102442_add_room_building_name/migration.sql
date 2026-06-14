-- Add an optional building name to rooms.
-- NOTE: `prisma migrate dev` also auto-generated enum-recreation and a batch of
-- constraint/index renames in this file. Those targeted tenant_template's exact
-- object names and are NOT portable across already-drifted tenant schemas, so
-- they were removed. Keep tenant migrations to the intended change, idempotent.
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "buildingName" TEXT;
