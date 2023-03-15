-- CreateTable
CREATE TABLE "SurveyTrigger" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "surveyId" TEXT NOT NULL,
    "eventClassId" TEXT NOT NULL,

    CONSTRAINT "SurveyTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyTrigger_surveyId_eventClassId_key" ON "SurveyTrigger"("surveyId", "eventClassId");

-- AddForeignKey
ALTER TABLE "SurveyTrigger" ADD CONSTRAINT "SurveyTrigger_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyTrigger" ADD CONSTRAINT "SurveyTrigger_eventClassId_fkey" FOREIGN KEY ("eventClassId") REFERENCES "EventClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
