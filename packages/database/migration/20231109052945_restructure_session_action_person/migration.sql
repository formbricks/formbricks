/*
  Warnings:

  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_eventClassId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_personId_fkey";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "Session";

ALTER TABLE "EventClass" RENAME TO "ActionClass";

-- AlterTable
ALTER TABLE "ActionClass" RENAME CONSTRAINT "EventClass_pkey" TO "ActionClass_pkey";

-- RenameForeignKey
ALTER TABLE "ActionClass" RENAME CONSTRAINT "EventClass_environmentId_fkey" TO "ActionClass_environmentId_fkey";

-- RenameIndex
ALTER INDEX "EventClass_name_environmentId_key" RENAME TO "ActionClass_name_environmentId_key";

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionClassId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_actionClassId_fkey" FOREIGN KEY ("actionClassId") REFERENCES "ActionClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurveyTrigger" RENAME COLUMN "eventClassId" TO "actionClassId";

-- RenameForeignKey
ALTER TABLE "SurveyTrigger" RENAME CONSTRAINT "SurveyTrigger_eventClassId_fkey" TO "SurveyTrigger_actionClassId_fkey";

-- RenameIndex
ALTER INDEX "SurveyTrigger_surveyId_eventClassId_key" RENAME TO "SurveyTrigger_surveyId_actionClassId_key";

ALTER TYPE "EventType" RENAME TO "ActionType";

-- CreateIndex
CREATE INDEX "Action_personId_idx" ON "Action"("personId");

-- CreateIndex
CREATE INDEX "Action_actionClassId_idx" ON "Action"("actionClassId");

/*
  Warnings:

  - A unique constraint covering the columns `[environmentId,userId]` on the table `Person` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "userId" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Person_environmentId_userId_key" ON "Person"("environmentId", "userId");

-- AlterTable
ALTER TABLE "Person" ALTER COLUMN "userId" DROP DEFAULT,
ALTER COLUMN "userId" SET DATA TYPE TEXT;
DROP SEQUENCE "Person_userId_seq";
