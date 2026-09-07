-- One transaction for the whole file. Prisma 7.8 does not add one, and these statements only make
-- sense together: a partial apply would leave the tables standing without their foreign keys, which
-- reads as a schema that was always shaped that way rather than as a failed migration. It is also
-- what makes the file rerunnable — a rollback leaves nothing behind to collide with on the retry.
--
-- `lock_timeout` is SET LOCAL so it expires with the transaction instead of leaking into whichever
-- migrations run after this one on the same connection. It matters because the foreign keys at the
-- bottom take a lock on "Survey" and "Workspace", which are live tables; failing fast is better than
-- queueing behind a long-running query and holding the lock queue open behind us.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
CREATE TYPE "EmbeddedDataSource" AS ENUM ('computed', 'ingested', 'reserved');

-- CreateEnum
CREATE TYPE "EmbeddedDataType" AS ENUM ('string', 'number', 'boolean', 'date');

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmbeddedData" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "EmbeddedDataSource" NOT NULL,
    "dataType" "EmbeddedDataType" NOT NULL DEFAULT 'string',
    "defaultValue" JSONB,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "surveyId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "EmbeddedData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SurveyEmbeddedData" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "embeddedDataId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "SurveyEmbeddedData_pkey" PRIMARY KEY ("id")
);

-- Every index below is on a table this same transaction just created, so it is built over zero rows
-- and locks nothing anyone else can reach. CONCURRENTLY is not an option here in any case: Postgres
-- rejects it inside a transaction block, and the transaction is what keeps the tables and their
-- foreign keys from being applied apart.

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "EmbeddedData_surveyId_idx" ON "EmbeddedData"("surveyId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "EmbeddedData_workspaceId_key_key" ON "EmbeddedData"("workspaceId", "key");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "EmbeddedData_id_workspaceId_key" ON "EmbeddedData"("id", "workspaceId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "SurveyEmbeddedData_embeddedDataId_idx" ON "SurveyEmbeddedData"("embeddedDataId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "SurveyEmbeddedData_surveyId_order_idx" ON "SurveyEmbeddedData"("surveyId", "order");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "SurveyEmbeddedData_surveyId_embeddedDataId_key" ON "SurveyEmbeddedData"("surveyId", "embeddedDataId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "SurveyEmbeddedData_surveyId_storageKey_key" ON "SurveyEmbeddedData"("surveyId", "storageKey");

-- Each foreign key below points *out* of a table this transaction just created, so the validating
-- scan reads zero rows and NOT VALID would defer nothing. What the statements do cost is a brief
-- lock on the referenced side ("Survey", "Workspace"), which the SET LOCAL above bounds.

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
ALTER TABLE "EmbeddedData" ADD CONSTRAINT "EmbeddedData_surveyId_workspaceId_fkey" FOREIGN KEY ("surveyId", "workspaceId") REFERENCES "Survey"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
ALTER TABLE "EmbeddedData" ADD CONSTRAINT "EmbeddedData_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
ALTER TABLE "SurveyEmbeddedData" ADD CONSTRAINT "SurveyEmbeddedData_surveyId_workspaceId_fkey" FOREIGN KEY ("surveyId", "workspaceId") REFERENCES "Survey"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
ALTER TABLE "SurveyEmbeddedData" ADD CONSTRAINT "SurveyEmbeddedData_embeddedDataId_workspaceId_fkey" FOREIGN KEY ("embeddedDataId", "workspaceId") REFERENCES "EmbeddedData"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
