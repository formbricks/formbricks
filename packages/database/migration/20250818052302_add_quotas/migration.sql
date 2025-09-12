-- CreateEnum
CREATE TYPE "SurveyQuotaAction" AS ENUM ('endSurvey', 'continueSurvey');

-- CreateEnum
CREATE TYPE "ResponseQuotaLinkStatus" AS ENUM ('screenedIn', 'screenedOut');

-- CreateTable
CREATE TABLE "SurveyQuota" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "surveyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "logic" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "action" "SurveyQuotaAction" NOT NULL,
    "endingCardId" TEXT,
    "countPartialSubmissions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SurveyQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseQuotaLink" (
    "responseId" TEXT NOT NULL,
    "quotaId" TEXT NOT NULL,
    "status" "ResponseQuotaLinkStatus" NOT NULL,

    CONSTRAINT "ResponseQuotaLink_pkey" PRIMARY KEY ("responseId","quotaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuota_surveyId_name_key" ON "SurveyQuota"("surveyId", "name");

-- CreateIndex
CREATE INDEX "SurveyQuota_surveyId_idx" ON "SurveyQuota"("surveyId");

-- CreateIndex
CREATE INDEX "ResponseQuotaLink_quotaId_status_idx" ON "ResponseQuotaLink"("quotaId", "status");

-- AddForeignKey
ALTER TABLE "SurveyQuota" ADD CONSTRAINT "SurveyQuota_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseQuotaLink" ADD CONSTRAINT "ResponseQuotaLink_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseQuotaLink" ADD CONSTRAINT "ResponseQuotaLink_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
