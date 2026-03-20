-- CreateTable
CREATE TABLE "SurveyResultShareLink" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyResultShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResultShareLink_token_key" ON "SurveyResultShareLink"("token");

-- CreateIndex
CREATE INDEX "SurveyResultShareLink_surveyId_idx" ON "SurveyResultShareLink"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyResultShareLink_token_idx" ON "SurveyResultShareLink"("token");

-- AddForeignKey
ALTER TABLE "SurveyResultShareLink" ADD CONSTRAINT "SurveyResultShareLink_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResultShareLink" ADD CONSTRAINT "SurveyResultShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
