/*
  Warnings:

  - A unique constraint covering the columns `[name,environmentId]` on the table `EventClass` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `environmentId` to the `EventClass` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EventClass" ADD COLUMN     "environmentId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EventClass_name_environmentId_key" ON "EventClass"("name", "environmentId");

-- AddForeignKey
ALTER TABLE "EventClass" ADD CONSTRAINT "EventClass_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
