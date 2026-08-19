/*
  Warnings:

  - A unique constraint covering the columns `[key,environmentId]` on the table `ActionClass` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ActionClass" ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ActionClass_key_environmentId_key" ON "ActionClass"("key", "environmentId");
