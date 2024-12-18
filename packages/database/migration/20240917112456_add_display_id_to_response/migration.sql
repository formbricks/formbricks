/*
  Warnings:

  - A unique constraint covering the columns `[displayId]` on the table `Response` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "displayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Response_displayId_key" ON "Response"("displayId");

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE SET NULL ON UPDATE CASCADE;
