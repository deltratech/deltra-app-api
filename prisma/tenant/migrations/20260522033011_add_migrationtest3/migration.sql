-- CreateTable
CREATE TABLE "test_3_migration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_name" TEXT NOT NULL,

    CONSTRAINT "test_3_migration_pkey" PRIMARY KEY ("id")
);
