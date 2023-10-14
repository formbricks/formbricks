/*
  Warnings:

  - Made the column `hiddenQuestionCard` on table `Survey` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Survey" ALTER COLUMN "hiddenQuestionCard" SET NOT NULL,
ALTER COLUMN "hiddenQuestionCard" SET DEFAULT '{"enabled": false}';
