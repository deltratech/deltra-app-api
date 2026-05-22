-- CreateTable
CREATE TABLE "test_2_migration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_name" TEXT NOT NULL,

    CONSTRAINT "test_2_migration_pkey" PRIMARY KEY ("id")
);
