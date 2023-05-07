/*
  Warnings:

  - You are about to drop the column `onboardingDisplayed` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "onboardingDisplayed",
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
