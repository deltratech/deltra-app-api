-- Per-user contract-approval delegate flag (e.g. vice principal acting for the principal).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contract_approver" BOOLEAN NOT NULL DEFAULT false;
