-- CreateEnum
CREATE TYPE "DataMigrationStatus" AS ENUM ('pending', 'applied', 'failed');

-- CreateTable
CREATE TABLE "DataMigration" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" "DataMigrationStatus" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DataMigration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataMigration_name_key" ON "DataMigration"("name");
