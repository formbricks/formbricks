/*
  Warnings:

  - Added the required column `value` to the `SurveyAttributeFilter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SurveyAttributeFilter" ADD COLUMN     "value" TEXT NOT NULL;
