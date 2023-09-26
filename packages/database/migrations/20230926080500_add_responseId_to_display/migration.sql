/*
  Warnings:

  - A unique constraint covering the columns `[responseId]` on the table `Display` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Display" ADD COLUMN     "responseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Display_responseId_key" ON "Display"("responseId");
