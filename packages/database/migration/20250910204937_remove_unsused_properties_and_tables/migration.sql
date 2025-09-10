/*
  Warnings:

  - The values [automatic] on the enum `ActionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `environmentId` on the `ApiKey` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `responseId` on the `Display` table. All the data in the column will be lost.
  - You are about to drop the column `deprecatedRole` on the `Invite` table. All the data in the column will be lost.
  - You are about to drop the column `deprecatedRole` on the `Membership` table. All the data in the column will be lost.
  - You are about to drop the column `brandColor` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `highlightBorderColor` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `resultShareKey` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `thankYouCard` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `verifyEmail` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Document` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentInsight` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Insight` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResponseNote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShortUrl` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `organizationId` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Made the column `label` on table `ApiKey` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."SurveyQuotaAction" AS ENUM ('endSurvey', 'continueSurvey');

-- CreateEnum
CREATE TYPE "public"."ResponseQuotaLinkStatus" AS ENUM ('screenedIn', 'screenedOut');

-- CreateEnum
CREATE TYPE "public"."ApiKeyPermission" AS ENUM ('read', 'write', 'manage');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ActionType_new" AS ENUM ('code', 'noCode');
ALTER TABLE "public"."ActionClass" ALTER COLUMN "type" TYPE "public"."ActionType_new" USING ("type"::text::"public"."ActionType_new");
ALTER TYPE "public"."ActionType" RENAME TO "ActionType_old";
ALTER TYPE "public"."ActionType_new" RENAME TO "ActionType";
DROP TYPE "public"."ActionType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."IdentityProvider" ADD VALUE 'saml';

-- AlterEnum
ALTER TYPE "public"."WebhookSource" ADD VALUE 'activepieces';

-- DropForeignKey
ALTER TABLE "public"."ApiKey" DROP CONSTRAINT "ApiKey_environmentId_fkey";

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

-- DropForeignKey
ALTER TABLE "public"."ResponseNote" DROP CONSTRAINT "ResponseNote_responseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ResponseNote" DROP CONSTRAINT "ResponseNote_userId_fkey";

-- DropIndex
DROP INDEX "public"."ApiKey_environmentId_idx";

-- DropIndex
DROP INDEX "public"."ApiKey_id_key";

-- DropIndex
DROP INDEX "public"."Display_responseId_key";

-- DropIndex
DROP INDEX "public"."Survey_resultShareKey_key";

-- AlterTable
ALTER TABLE "public"."ApiKey" DROP COLUMN "environmentId",
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "organizationAccess" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "organizationId" TEXT NOT NULL,
ALTER COLUMN "label" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Contact" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "public"."Display" DROP COLUMN "responseId";

-- AlterTable
ALTER TABLE "public"."Invite" DROP COLUMN "deprecatedRole",
ADD COLUMN     "teamIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."Membership" DROP COLUMN "deprecatedRole";

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "whitelabel" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."Project" DROP COLUMN "brandColor",
DROP COLUMN "highlightBorderColor";

-- AlterTable
ALTER TABLE "public"."Response" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."Survey" DROP COLUMN "resultShareKey",
DROP COLUMN "thankYouCard",
DROP COLUMN "verifyEmail",
ADD COLUMN     "isBackButtonHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "recaptcha" JSONB DEFAULT '{"enabled": false, "threshold":0.1}';

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "imageUrl",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Webhook" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "public"."Document";

-- DropTable
DROP TABLE "public"."DocumentInsight";

-- DropTable
DROP TABLE "public"."Insight";

-- DropTable
DROP TABLE "public"."ResponseNote";

-- DropTable
DROP TABLE "public"."ShortUrl";

-- DropEnum
DROP TYPE "public"."InsightCategory";

-- DropEnum
DROP TYPE "public"."MembershipRole";

-- DropEnum
DROP TYPE "public"."Sentiment";

-- CreateTable
CREATE TABLE "public"."SurveyQuota" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "surveyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "logic" JSONB NOT NULL DEFAULT '{}',
    "action" "public"."SurveyQuotaAction" NOT NULL,
    "endingCardId" TEXT,
    "countPartialSubmissions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SurveyQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResponseQuotaLink" (
    "responseId" TEXT NOT NULL,
    "quotaId" TEXT NOT NULL,
    "status" "public"."ResponseQuotaLinkStatus" NOT NULL,

    CONSTRAINT "ResponseQuotaLink_pkey" PRIMARY KEY ("responseId","quotaId")
);

-- CreateTable
CREATE TABLE "public"."ApiKeyEnvironment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "permission" "public"."ApiKeyPermission" NOT NULL,

    CONSTRAINT "ApiKeyEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyQuota_surveyId_idx" ON "public"."SurveyQuota"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuota_surveyId_name_key" ON "public"."SurveyQuota"("surveyId", "name");

-- CreateIndex
CREATE INDEX "ResponseQuotaLink_quotaId_status_idx" ON "public"."ResponseQuotaLink"("quotaId", "status");

-- CreateIndex
CREATE INDEX "ApiKeyEnvironment_environmentId_idx" ON "public"."ApiKeyEnvironment"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyEnvironment_apiKeyId_environmentId_key" ON "public"."ApiKeyEnvironment"("apiKeyId", "environmentId");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "public"."ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "Response_created_at_idx" ON "public"."Response"("created_at");

-- AddForeignKey
ALTER TABLE "public"."SurveyQuota" ADD CONSTRAINT "SurveyQuota_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResponseQuotaLink" ADD CONSTRAINT "ResponseQuotaLink_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResponseQuotaLink" ADD CONSTRAINT "ResponseQuotaLink_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "public"."SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKeyEnvironment" ADD CONSTRAINT "ApiKeyEnvironment_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKeyEnvironment" ADD CONSTRAINT "ApiKeyEnvironment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "public"."Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
