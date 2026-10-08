-- Work left over after a delete commits: Hub records and storage files (ENG-3612). A new, empty table
-- with no foreign keys, so nothing else is locked or rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
CREATE TYPE "DeletionCleanupKind" AS ENUM ('hubSurvey', 'hubResponses', 'storageFiles', 'storageSurveyFolder');

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeletionCleanup" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "kind" "DeletionCleanupKind" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "tenantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "DeletionCleanup_pkey" PRIMARY KEY ("id"),
    -- A survey cleanup never names responses (it would otherwise read as "only these"), a responses
    -- cleanup always does (an empty list must never widen to the whole survey), and a storage cleanup
    -- always names its files. Every side is NULL-safe: `cardinality(NULL) > 0` is NULL, which a CHECK
    -- would let through.
    CONSTRAINT "DeletionCleanup_kind_check" CHECK (
        ("kind" = 'hubSurvey' AND COALESCE(cardinality("responseIds"), 0) = 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
        OR ("kind" = 'hubResponses' AND COALESCE(cardinality("responseIds"), 0) > 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
        OR ("kind" = 'storageFiles' AND COALESCE(cardinality("fileKeys"), 0) > 0 AND COALESCE(cardinality("responseIds"), 0) = 0)
        OR ("kind" = 'storageSurveyFolder' AND COALESCE(cardinality("responseIds"), 0) = 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
    )
);

-- CreateIndex
-- The table was created by this same transaction, so the index is built over zero rows.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "DeletionCleanup_nextAttemptAt_idx" ON "DeletionCleanup"("nextAttemptAt");

COMMIT;
