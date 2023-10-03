/*
  Warnings:

  - A unique constraint covering the columns `[surveyId,singleUseId]` on the table `Response` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "singleUseId" TEXT;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "singleUse" JSONB DEFAULT '{"enabled": false, "isEncrypted": true}';

-- CreateIndex
CREATE UNIQUE INDEX "Response_surveyId_singleUseId_key" ON "Response"("surveyId", "singleUseId");
