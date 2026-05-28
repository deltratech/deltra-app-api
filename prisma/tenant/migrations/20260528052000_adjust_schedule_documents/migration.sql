CREATE TYPE "period_kind" AS ENUM ('lesson', 'recess', 'break');

DROP TABLE "schedules";

CREATE TABLE "period_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "grade_level" SMALLINT NOT NULL,
  "academic_year" TEXT NOT NULL,
  "day_start" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "period_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "period_templates_grade_level_academic_year_key"
ON "period_templates"("grade_level", "academic_year");

CREATE TABLE "period_rows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "template_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "kind" "period_kind" NOT NULL,
  "label" TEXT NOT NULL,
  "duration_min" INTEGER NOT NULL,
  "active_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  CONSTRAINT "period_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "period_rows_duration_min_check" CHECK ("duration_min" > 0)
);

CREATE UNIQUE INDEX "period_rows_template_id_sort_order_key"
ON "period_rows"("template_id", "sort_order");

ALTER TABLE "period_rows"
ADD CONSTRAINT "period_rows_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "period_templates"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "classroom_id" UUID NOT NULL,
  "academic_year" TEXT NOT NULL,
  "semester" SMALLINT NOT NULL,
  "status" "schedule_status" NOT NULL DEFAULT 'draft',
  "published_at" TIMESTAMPTZ(6),
  "archived_at" TIMESTAMPTZ(6),
  "copied_from_schedule_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedules_classroom_id_academic_year_semester_key"
ON "schedules"("classroom_id", "academic_year", "semester");

ALTER TABLE "schedules"
ADD CONSTRAINT "schedules_classroom_id_fkey"
FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedules"
ADD CONSTRAINT "schedules_copied_from_schedule_id_fkey"
FOREIGN KEY ("copied_from_schedule_id") REFERENCES "schedules"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "schedule_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schedule_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "teacher_profile_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "day_of_week" SMALLINT,
  "period_row_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "schedule_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_entries_day_of_week_check" CHECK ("day_of_week" BETWEEN 1 AND 5 OR "day_of_week" IS NULL),
  CONSTRAINT "schedule_entries_tray_pair_check" CHECK (
    ("day_of_week" IS NULL AND "period_row_id" IS NULL)
    OR ("day_of_week" IS NOT NULL AND "period_row_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "schedule_entries_one_block_per_cell_idx"
ON "schedule_entries"("schedule_id", "day_of_week", "period_row_id")
WHERE "day_of_week" IS NOT NULL AND "period_row_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX "schedule_entries_teacher_profile_id_day_of_week_period_row_id_idx"
ON "schedule_entries"("teacher_profile_id", "day_of_week", "period_row_id");

CREATE INDEX "schedule_entries_room_id_day_of_week_period_row_id_idx"
ON "schedule_entries"("room_id", "day_of_week", "period_row_id");

ALTER TABLE "schedule_entries"
ADD CONSTRAINT "schedule_entries_schedule_id_fkey"
FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_entries"
ADD CONSTRAINT "schedule_entries_subject_id_fkey"
FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_entries"
ADD CONSTRAINT "schedule_entries_teacher_profile_id_fkey"
FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_entries"
ADD CONSTRAINT "schedule_entries_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_entries"
ADD CONSTRAINT "schedule_entries_period_row_id_fkey"
FOREIGN KEY ("period_row_id") REFERENCES "period_rows"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE VIEW "period_row_times" AS
SELECT
  pr."id",
  pr."template_id",
  pr."sort_order",
  pr."kind",
  pr."label",
  pr."duration_min",
  pr."active_days",
  pt."day_start",
  (
    pt."day_start"::time
    + (
      COALESCE(
        SUM(pr."duration_min") OVER (
          PARTITION BY pr."template_id"
          ORDER BY pr."sort_order"
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        0
      ) || ' minutes'
    )::interval
  )::time AS "start_time",
  (
    pt."day_start"::time
    + (
      SUM(pr."duration_min") OVER (
        PARTITION BY pr."template_id"
        ORDER BY pr."sort_order"
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) || ' minutes'
    )::interval
  )::time AS "end_time"
FROM "period_rows" pr
JOIN "period_templates" pt ON pt."id" = pr."template_id";
