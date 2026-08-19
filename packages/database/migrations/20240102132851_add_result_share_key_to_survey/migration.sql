/*
  Warnings:

  - A unique constraint covering the columns `[resultShareKey]` on the table `Survey` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "resultShareKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Survey_resultShareKey_key" ON "Survey"("resultShareKey");
