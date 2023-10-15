/*
  Warnings:

  - You are about to drop the column `hiddenQuestionCard` on the `Survey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "hiddenQuestionCard",
ADD COLUMN     "hiddenFieldsCard" JSONB NOT NULL DEFAULT '{"enabled": false}';
