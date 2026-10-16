-- Separate from the visibility migration so databases that already applied it also get provenance.
-- Sorted before owner catch-up, which must distinguish 6.1 API attribution from authorization ownership.
SET lock_timeout = '1s';
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "ownershipInitialized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "legacyEmbeddedDataBackup" JSONB;
RESET lock_timeout;
