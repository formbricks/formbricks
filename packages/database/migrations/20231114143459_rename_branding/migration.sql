/*
  Warnings:

  - You are about to drop the column `formbricksSignature` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" RENAME COLUMN "formbricksSignature" TO "linkSurveyBranding";
ALTER TABLE "Product" ADD COLUMN "inAppSurveyBranding" BOOLEAN NOT NULL DEFAULT true;
