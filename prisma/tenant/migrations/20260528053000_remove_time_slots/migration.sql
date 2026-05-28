ALTER TABLE "teacher_unavailability"
DROP CONSTRAINT IF EXISTS "teacher_unavailability_time_slot_id_fkey";

DROP INDEX IF EXISTS "teacher_unavailability_teacher_profile_id_day_of_week_time_slot_id_key";

ALTER TABLE "teacher_unavailability"
DROP COLUMN IF EXISTS "time_slot_id",
ADD COLUMN "period_row_id" UUID;

ALTER TABLE "teacher_unavailability"
ALTER COLUMN "day_of_week" TYPE SMALLINT
USING CASE "day_of_week"::text
  WHEN 'monday' THEN 1
  WHEN 'tuesday' THEN 2
  WHEN 'wednesday' THEN 3
  WHEN 'thursday' THEN 4
  WHEN 'friday' THEN 5
  WHEN 'saturday' THEN 6
  ELSE NULL
END;

DELETE FROM "teacher_unavailability"
WHERE "period_row_id" IS NULL;

ALTER TABLE "teacher_unavailability"
ALTER COLUMN "period_row_id" SET NOT NULL,
ADD CONSTRAINT "teacher_unavailability_day_of_week_check"
CHECK ("day_of_week" BETWEEN 1 AND 5);

CREATE UNIQUE INDEX "teacher_unavailability_teacher_profile_id_day_of_week_period_row_id_key"
ON "teacher_unavailability"("teacher_profile_id", "day_of_week", "period_row_id");

ALTER TABLE "teacher_unavailability"
ADD CONSTRAINT "teacher_unavailability_period_row_id_fkey"
FOREIGN KEY ("period_row_id") REFERENCES "period_rows"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE IF EXISTS "time_slots";
