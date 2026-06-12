-- Admissions — Fees & Invoices (idempotent: db push may have created these first)

DO $$ BEGIN
  CREATE TYPE "admission_fee_type" AS ENUM ('application','test','psychotest','registration','admission','development','tuition','activities','books','uniform','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "admission_payment_term" AS ENUM ('one_time','upon_registration','upon_admission','monthly','per_term','per_semester','yearly');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "admission_invoice_status" AS ENUM ('draft','sent','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "admission_fee_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_level" "admission_school_level" NOT NULL,
  "grade_label" TEXT,
  "student_category" "admission_student_category",
  "fee_type" "admission_fee_type" NOT NULL,
  "academic_year" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "payment_term" "admission_payment_term" NOT NULL DEFAULT 'one_time',
  "label" TEXT,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "admission_fee_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_fee_schedules_academic_year_school_level_idx" ON "admission_fee_schedules"("academic_year","school_level");

CREATE TABLE IF NOT EXISTS "admission_development_fee_tiers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_level" "admission_school_level" NOT NULL,
  "student_category" "admission_student_category",
  "duration_label" TEXT NOT NULL,
  "grade_from_label" TEXT NOT NULL,
  "grade_to_label" TEXT,
  "amount" INTEGER NOT NULL,
  "payment_term" "admission_payment_term" NOT NULL DEFAULT 'upon_registration',
  "academic_year" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "admission_development_fee_tiers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_development_fee_tiers_academic_year_school_level_idx" ON "admission_development_fee_tiers"("academic_year","school_level");

CREATE TABLE IF NOT EXISTS "admission_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "invoice_no" TEXT NOT NULL,
  "status" "admission_invoice_status" NOT NULL DEFAULT 'draft',
  "due_date" DATE,
  "total_amount" INTEGER NOT NULL,
  "paid_amount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "admission_invoices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_invoices_application_id_idx" ON "admission_invoices"("application_id");

CREATE TABLE IF NOT EXISTS "admission_invoice_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "fee_type" "admission_fee_type",
  "period_label" TEXT,
  "fee_schedule_id" UUID,
  "dev_fee_tier_id" UUID,
  CONSTRAINT "admission_invoice_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admission_invoice_items_invoice_id_idx" ON "admission_invoice_items"("invoice_id");

DO $$ BEGIN
  ALTER TABLE "admission_invoices" ADD CONSTRAINT "admission_invoices_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "admission_invoice_items" ADD CONSTRAINT "admission_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "admission_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
