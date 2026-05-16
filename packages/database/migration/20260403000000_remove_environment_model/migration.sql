-- Remove environmentId columns and indexes from all environment-owned models
-- This is safe to run after workspaceId has been backfilled and made NOT NULL

-- Step 0: Add legacyEnvironmentId to Workspace and backfill from production Environment
ALTER TABLE "Workspace" ADD COLUMN "legacyEnvironmentId" TEXT;

UPDATE "Workspace" w
SET "legacyEnvironmentId" = e."id"
FROM "Environment" e
WHERE e."workspaceId" = w."id"
  AND e."type" = 'production';

CREATE UNIQUE INDEX "Workspace_legacyEnvironmentId_key" ON "Workspace"("legacyEnvironmentId");

-- Drop environmentId indexes first
DROP INDEX IF EXISTS "Webhook_environmentId_idx";
DROP INDEX IF EXISTS "ContactAttributeKey_environmentId_createdAt_idx";
DROP INDEX IF EXISTS "Contact_environmentId_idx";
DROP INDEX IF EXISTS "Survey_environmentId_updatedAt_idx";
DROP INDEX IF EXISTS "ActionClass_environmentId_createdAt_idx";
DROP INDEX IF EXISTS "Integration_environmentId_idx";
DROP INDEX IF EXISTS "ApiKeyEnvironment_environmentId_idx";
DROP INDEX IF EXISTS "Environment_workspaceId_idx";

-- Drop foreign key constraints referencing Environment
ALTER TABLE "Webhook" DROP CONSTRAINT IF EXISTS "Webhook_environmentId_fkey";
ALTER TABLE "ContactAttributeKey" DROP CONSTRAINT IF EXISTS "ContactAttributeKey_environmentId_fkey";
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_environmentId_fkey";
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_environmentId_fkey";
ALTER TABLE "Survey" DROP CONSTRAINT IF EXISTS "Survey_environmentId_fkey";
ALTER TABLE "ActionClass" DROP CONSTRAINT IF EXISTS "ActionClass_environmentId_fkey";
ALTER TABLE "Integration" DROP CONSTRAINT IF EXISTS "Integration_environmentId_fkey";
ALTER TABLE "ApiKeyEnvironment" DROP CONSTRAINT IF EXISTS "ApiKeyEnvironment_environmentId_fkey";
ALTER TABLE "Segment" DROP CONSTRAINT IF EXISTS "Segment_environmentId_fkey";

-- Drop environmentId columns
ALTER TABLE "Webhook" DROP COLUMN IF EXISTS "environmentId";
ALTER TABLE "ContactAttributeKey" DROP COLUMN IF EXISTS "environmentId";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "environmentId";
ALTER TABLE "Tag" DROP COLUMN IF EXISTS "environmentId";
ALTER TABLE "Survey" DROP COLUMN IF EXISTS "environmentId";
ALTER TABLE "ActionClass" DROP COLUMN IF EXISTS "environmentId";
ALTER TABLE "Integration" DROP COLUMN IF EXISTS "environmentId";
ALTER TABLE "ApiKeyEnvironment" DROP COLUMN IF EXISTS "environmentId";
ALTER TABLE "Segment" DROP COLUMN IF EXISTS "environmentId";

-- Drop the Environment table
DROP TABLE IF EXISTS "Environment";

-- Drop the EnvironmentType enum
DROP TYPE IF EXISTS "EnvironmentType";

-- Rename ApiKeyEnvironment table to ApiKeyWorkspace
ALTER TABLE "ApiKeyEnvironment" RENAME TO "ApiKeyWorkspace";

-- Rename indexes to match new table name
ALTER INDEX "ApiKeyEnvironment_pkey" RENAME TO "ApiKeyWorkspace_pkey";
ALTER INDEX "ApiKeyEnvironment_apiKeyId_workspaceId_key" RENAME TO "ApiKeyWorkspace_apiKeyId_workspaceId_key";
ALTER INDEX "ApiKeyEnvironment_workspaceId_idx" RENAME TO "ApiKeyWorkspace_workspaceId_idx";

-- Rename foreign key constraints to match new table name
ALTER TABLE "ApiKeyWorkspace" RENAME CONSTRAINT "ApiKeyEnvironment_apiKeyId_fkey" TO "ApiKeyWorkspace_apiKeyId_fkey";
ALTER TABLE "ApiKeyWorkspace" RENAME CONSTRAINT "ApiKeyEnvironment_workspaceId_fkey" TO "ApiKeyWorkspace_workspaceId_fkey";
