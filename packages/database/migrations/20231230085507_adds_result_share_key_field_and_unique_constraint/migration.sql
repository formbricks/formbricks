/*
  Warnings:

  - A unique constraint covering the columns `[id,resultShareKey]` on the table `Survey` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "resultShareKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Survey_id_resultShareKey_key" ON "Survey"("id", "resultShareKey");
