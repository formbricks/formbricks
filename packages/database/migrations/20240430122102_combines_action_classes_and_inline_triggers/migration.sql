/*
  Warnings:

  - A unique constraint covering the columns `[key,environmentId]` on the table `ActionClass` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ActionClass_name_environmentId_key";

-- AlterTable
ALTER TABLE "ActionClass" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ActionClass_key_environmentId_key" ON "ActionClass"("key", "environmentId");
