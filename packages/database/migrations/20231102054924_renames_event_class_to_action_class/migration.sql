ALTER TABLE "SurveyTrigger" RENAME COLUMN "eventClassId" TO "actionClassId";

-- RenameForeignKey
ALTER TABLE "SurveyTrigger" RENAME CONSTRAINT "SurveyTrigger_eventClassId_fkey" TO "SurveyTrigger_actionClassId_fkey";

-- RenameIndex
ALTER INDEX "SurveyTrigger_surveyId_eventClassId_key" RENAME TO "SurveyTrigger_surveyId_actionClassId_key";

ALTER TYPE "EventType" RENAME TO "ActionType";