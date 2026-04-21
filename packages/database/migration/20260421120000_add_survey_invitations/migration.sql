-- AlterTable
ALTER TABLE "public"."Survey" ADD COLUMN     "invitationConfig" JSONB;

-- CreateTable
CREATE TABLE "public"."SurveyInvitation" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "surveyId" TEXT NOT NULL,
    "contactId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "linkToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "responseId" TEXT,
    "lastReminderAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "sentOffsetDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "SurveyInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyInvitation_linkToken_key" ON "public"."SurveyInvitation"("linkToken");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyInvitation_responseId_key" ON "public"."SurveyInvitation"("responseId");

-- CreateIndex
CREATE INDEX "SurveyInvitation_surveyId_respondedAt_idx" ON "public"."SurveyInvitation"("surveyId", "respondedAt");

-- CreateIndex
CREATE INDEX "SurveyInvitation_surveyId_contactId_idx" ON "public"."SurveyInvitation"("surveyId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyInvitation_surveyId_recipientEmail_key" ON "public"."SurveyInvitation"("surveyId", "recipientEmail");

-- AddForeignKey
ALTER TABLE "public"."SurveyInvitation" ADD CONSTRAINT "SurveyInvitation_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyInvitation" ADD CONSTRAINT "SurveyInvitation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyInvitation" ADD CONSTRAINT "SurveyInvitation_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."Response"("id") ON DELETE SET NULL ON UPDATE CASCADE;
