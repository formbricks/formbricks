-- Creatives (ENG-3993): one "Creative" table for every type, its triggers and its languages. Additive
-- only: three new enums and three new, empty tables. No existing column changes and no data moves.
--
-- One transaction for the whole file, which is also what makes it rerunnable: a rollback leaves nothing
-- behind to collide with on the retry. Every type, table, index and constraint is created guarded, and
-- the CHECKs and foreign keys are added apart from their tables, so the file also converges on a
-- database built with `db:push`, which has the tables but none of the CHECKs.
--
-- `lock_timeout` is SET LOCAL so it expires with the transaction instead of leaking into the migrations
-- that run after this one on the same connection. The foreign keys at the bottom lock "Workspace",
-- "User", "Survey", "ActionClass" and "Language", which are live tables; failing fast is better than
-- queueing behind a long-running query and holding the lock queue open behind us.
--
-- The indexes are built on tables created in this same transaction, which are empty and invisible to
-- every other session, so building them concurrently would buy nothing.
--
-- The Destination is a composite foreign key ("surveyId", "workspaceId") onto "Survey"("id",
-- "workspaceId"), so a creative can only open a survey of its own workspace. It is NO ACTION, not
-- RESTRICT (ADR 0010): NO ACTION is checked at the end of the statement, so deleting a workspace or an
-- organization removes the creative through its own cascade first, while deleting the survey on its own
-- still fails until the creative is unlinked.
--
-- The CHECKs hold what Prisma cannot express: a creative opens at most one Destination, and the share of
-- visitors stays a percentage. The API validates both; these are backstops. Prisma neither models nor
-- drops CHECK constraints, so they cause no schema drift.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "CreativeType" AS ENUM ('feedbackButton', 'banner');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "CreativeStatus" AS ENUM ('draft', 'inProgress', 'paused', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "CreativeShowOn" AS ENUM ('pageView', 'action');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Creative" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CreativeType" NOT NULL,
    "status" "CreativeStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT,
    "content" JSONB NOT NULL,
    "styling" JSONB NOT NULL,
    "surveyId" TEXT,
    "linkUrl" TEXT,
    "showOn" "CreativeShowOn" NOT NULL DEFAULT 'pageView',
    "showConditions" JSONB,
    "displayPercentage" DOUBLE PRECISION,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "Creative" ADD CONSTRAINT "Creative_destination_check" CHECK (num_nonnulls("surveyId", "linkUrl") <= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Creative" ADD CONSTRAINT "Creative_display_percentage_check" CHECK ("displayPercentage" IS NULL OR ("displayPercentage" > 0 AND "displayPercentage" <= 100));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreativeTrigger" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "creativeId" TEXT NOT NULL,
    "actionClassId" TEXT NOT NULL,

    CONSTRAINT "CreativeTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreativeLanguage" (
    "languageId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "default" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CreativeLanguage_pkey" PRIMARY KEY ("languageId","creativeId")
);

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "Creative_workspaceId_updated_at_idx" ON "Creative"("workspaceId", "updated_at");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "Creative_surveyId_idx" ON "Creative"("surveyId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "CreativeTrigger_actionClassId_idx" ON "CreativeTrigger"("actionClassId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "CreativeTrigger_creativeId_actionClassId_key" ON "CreativeTrigger"("creativeId", "actionClassId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "CreativeLanguage_creativeId_idx" ON "CreativeLanguage"("creativeId");

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "Creative" ADD CONSTRAINT "Creative_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "Creative" ADD CONSTRAINT "Creative_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "Creative" ADD CONSTRAINT "Creative_surveyId_workspaceId_fkey" FOREIGN KEY ("surveyId", "workspaceId") REFERENCES "Survey"("id", "workspaceId") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "CreativeTrigger" ADD CONSTRAINT "CreativeTrigger_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "CreativeTrigger" ADD CONSTRAINT "CreativeTrigger_actionClassId_fkey" FOREIGN KEY ("actionClassId") REFERENCES "ActionClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "CreativeLanguage" ADD CONSTRAINT "CreativeLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "CreativeLanguage" ADD CONSTRAINT "CreativeLanguage_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
