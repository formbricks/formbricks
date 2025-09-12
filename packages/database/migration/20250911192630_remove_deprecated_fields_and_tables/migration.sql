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
CREATE TYPE "public"."SurveyType_new" AS ENUM ('link', 'app');
ALTER TABLE "public"."Survey" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "public"."Survey" ALTER COLUMN "type" TYPE "public"."SurveyType_new" USING ("type"::text::"public"."SurveyType_new");
ALTER TYPE "public"."SurveyType" RENAME TO "SurveyType_old";
ALTER TYPE "public"."SurveyType_new" RENAME TO "SurveyType";
DROP TYPE "public"."SurveyType_old";
ALTER TABLE "public"."Survey" ALTER COLUMN "type" SET DEFAULT 'app';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_environmentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_responseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_surveyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DocumentInsight" DROP CONSTRAINT "DocumentInsight_documentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DocumentInsight" DROP CONSTRAINT "DocumentInsight_insightId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Insight" DROP CONSTRAINT "Insight_environmentId_fkey";

-- DropIndex
DROP INDEX "public"."Display_responseId_key";

-- AlterTable
ALTER TABLE "public"."Display" DROP COLUMN "responseId",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "public"."Environment" DROP COLUMN "widgetSetupCompleted";

-- AlterTable
ALTER TABLE "public"."Invite" DROP COLUMN "deprecatedRole";

-- AlterTable
ALTER TABLE "public"."Membership" DROP COLUMN "deprecatedRole";

-- AlterTable
ALTER TABLE "public"."Project" DROP COLUMN "brandColor",
DROP COLUMN "highlightBorderColor";

-- AlterTable
ALTER TABLE "public"."Survey" DROP COLUMN "thankYouCard",
DROP COLUMN "verifyEmail",
ALTER COLUMN "type" SET DEFAULT 'app';

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "objective",
DROP COLUMN "role";

-- DropTable
DROP TABLE "public"."Document";

-- DropTable
DROP TABLE "public"."DocumentInsight";

-- DropTable
DROP TABLE "public"."Insight";

-- DropEnum
DROP TYPE "public"."DisplayStatus";

-- DropEnum
DROP TYPE "public"."InsightCategory";

-- DropEnum
DROP TYPE "public"."Intention";

-- DropEnum
DROP TYPE "public"."MembershipRole";

-- DropEnum
DROP TYPE "public"."Objective";

-- DropEnum
DROP TYPE "public"."Role";

-- DropEnum
DROP TYPE "public"."Sentiment";
