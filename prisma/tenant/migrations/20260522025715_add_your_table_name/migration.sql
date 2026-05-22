-- CreateTable
CREATE TABLE "test_migrate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,

    CONSTRAINT "test_migrate_pkey" PRIMARY KEY ("id")
);
