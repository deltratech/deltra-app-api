-- CreateTable
CREATE TABLE "TestMigrationCMD" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,

    CONSTRAINT "TestMigrationCMD_pkey" PRIMARY KEY ("id")
);
