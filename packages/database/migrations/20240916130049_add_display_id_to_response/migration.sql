/*
  Warnings:

  - A unique constraint covering the columns `[displayId]` on the table `Response` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "displayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Response_displayId_key" ON "Response"("displayId");

-- AddForeignKey
ALTER TABLE "Display" ADD CONSTRAINT "Display_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
