-- Short access code for application lookup-by-number (idempotent)
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "tracking_code" TEXT;
