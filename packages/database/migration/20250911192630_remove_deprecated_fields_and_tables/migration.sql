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
ALTER TABLE IF EXISTS "Document" DROP CONSTRAINT IF EXISTS "Document_environmentId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "Document" DROP CONSTRAINT IF EXISTS "Document_responseId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "Document" DROP CONSTRAINT IF EXISTS "Document_surveyId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "DocumentInsight" DROP CONSTRAINT IF EXISTS "DocumentInsight_documentId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "DocumentInsight" DROP CONSTRAINT IF EXISTS "DocumentInsight_insightId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "Insight" DROP CONSTRAINT IF EXISTS "Insight_environmentId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Display_responseId_key";

-- AlterTable
ALTER TABLE "Display" DROP COLUMN IF EXISTS "responseId",
DROP COLUMN IF EXISTS "status";

-- AlterTable
ALTER TABLE "Environment" DROP COLUMN IF EXISTS "widgetSetupCompleted";

-- AlterTable
ALTER TABLE "Invite" DROP COLUMN IF EXISTS "deprecatedRole";

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN IF EXISTS "deprecatedRole";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN IF EXISTS "brandColor",
DROP COLUMN IF EXISTS "highlightBorderColor";

-- AlterTable
ALTER TABLE "Survey" DROP COLUMN IF EXISTS "thankYouCard",
DROP COLUMN IF EXISTS "verifyEmail",
ALTER COLUMN "type" SET DEFAULT 'app';

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "objective",
DROP COLUMN IF EXISTS "role";

-- DropTable
DROP TABLE IF EXISTS "Document";

-- DropTable
DROP TABLE IF EXISTS "DocumentInsight";

-- DropTable
DROP TABLE IF EXISTS "Insight";

-- DropEnum
DROP TYPE IF EXISTS "DisplayStatus";

-- DropEnum
DROP TYPE IF EXISTS "InsightCategory";

-- DropEnum
DROP TYPE IF EXISTS "Intention";

-- DropEnum
DROP TYPE IF EXISTS "MembershipRole";

-- DropEnum
DROP TYPE IF EXISTS "Objective";

-- DropEnum
DROP TYPE IF EXISTS "Role";

-- DropEnum
DROP TYPE IF EXISTS "Sentiment";
