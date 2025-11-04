/*
  Warnings:

  - The values [web,website] on the enum `SurveyType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `responseId` on the `Display` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Display` table. All the data in the column will be lost.
  - You are about to drop the column `widgetSetupCompleted` on the `Environment` table. All the data in the column will be lost.
  - You are about to drop the column `deprecatedRole` on the `Invite` table. All the data in the column will be lost.
  - You are about to drop the column `deprecatedRole` on the `Membership` table. All the data in the column will be lost.
  - You are about to drop the column `brandColor` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `highlightBorderColor` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `thankYouCard` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `verifyEmail` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `objective` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Document` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentInsight` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Insight` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SurveyType_new" AS ENUM ('link', 'app');
ALTER TABLE "Survey" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Survey" ALTER COLUMN "type" TYPE "SurveyType_new" USING ("type"::text::"SurveyType_new");
ALTER TYPE "SurveyType" RENAME TO "SurveyType_old";
ALTER TYPE "SurveyType_new" RENAME TO "SurveyType";
DROP TYPE "SurveyType_old";
ALTER TABLE "Survey" ALTER COLUMN "type" SET DEFAULT 'app';
COMMIT;

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_environmentId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_responseId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_surveyId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentInsight" DROP CONSTRAINT "DocumentInsight_documentId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentInsight" DROP CONSTRAINT "DocumentInsight_insightId_fkey";

-- DropForeignKey
ALTER TABLE "Insight" DROP CONSTRAINT "Insight_environmentId_fkey";

-- DropIndex
DROP INDEX "Display_responseId_key";

-- AlterTable
ALTER TABLE "Display" DROP COLUMN "responseId",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Environment" DROP COLUMN "widgetSetupCompleted";

-- AlterTable
ALTER TABLE "Invite" DROP COLUMN "deprecatedRole";

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "deprecatedRole";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "brandColor",
DROP COLUMN "highlightBorderColor";

-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "thankYouCard",
DROP COLUMN "verifyEmail",
ALTER COLUMN "type" SET DEFAULT 'app';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "objective",
DROP COLUMN "role";

-- DropTable
DROP TABLE "Document";

-- DropTable
DROP TABLE "DocumentInsight";

-- DropTable
DROP TABLE "Insight";

-- DropEnum
DROP TYPE "DisplayStatus";

-- DropEnum
DROP TYPE "InsightCategory";

-- DropEnum
DROP TYPE "Intention";

-- DropEnum
DROP TYPE "MembershipRole";

-- DropEnum
DROP TYPE "Objective";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "Sentiment";
