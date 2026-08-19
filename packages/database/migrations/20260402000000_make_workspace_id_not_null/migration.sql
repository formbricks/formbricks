-- Safety check: abort if any NULLs remain (backfill must have run first)
DO $$
DECLARE
  null_count bigint;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "Survey" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot set NOT NULL: % Survey rows have NULL workspaceId', null_count;
  END IF;
END $$;

-- Make workspaceId NOT NULL on all environment-owned models
ALTER TABLE "Webhook" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ContactAttributeKey" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Contact" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Survey" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ActionClass" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Integration" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ApiKeyEnvironment" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Segment" ALTER COLUMN "workspaceId" SET NOT NULL;

-- Migrate unique indexes from environmentId to workspaceId
-- (safe to run after dev environment promotion — no duplicates possible)
-- Note: Prisma creates these as unique indexes, not constraints, so we use DROP INDEX / CREATE UNIQUE INDEX

-- ContactAttributeKey: @@unique([key, environmentId]) -> @@unique([key, workspaceId])
DROP INDEX "ContactAttributeKey_key_environmentId_key";
CREATE UNIQUE INDEX "ContactAttributeKey_key_workspaceId_key" ON "ContactAttributeKey"("key", "workspaceId");

-- Tag: @@unique([environmentId, name]) -> @@unique([workspaceId, name])
DROP INDEX "Tag_environmentId_name_key";
CREATE UNIQUE INDEX "Tag_workspaceId_name_key" ON "Tag"("workspaceId", "name");

-- ActionClass: @@unique([key, environmentId]) -> @@unique([key, workspaceId])
DROP INDEX "ActionClass_key_environmentId_key";
CREATE UNIQUE INDEX "ActionClass_key_workspaceId_key" ON "ActionClass"("key", "workspaceId");

-- ActionClass: @@unique([name, environmentId]) -> @@unique([name, workspaceId])
DROP INDEX "ActionClass_name_environmentId_key";
CREATE UNIQUE INDEX "ActionClass_name_workspaceId_key" ON "ActionClass"("name", "workspaceId");

-- Integration: @@unique([type, environmentId]) -> @@unique([type, workspaceId])
DROP INDEX "Integration_type_environmentId_key";
CREATE UNIQUE INDEX "Integration_type_workspaceId_key" ON "Integration"("type", "workspaceId");

-- ApiKeyEnvironment: @@unique([apiKeyId, environmentId]) -> @@unique([apiKeyId, workspaceId])
DROP INDEX "ApiKeyEnvironment_apiKeyId_environmentId_key";
CREATE UNIQUE INDEX "ApiKeyEnvironment_apiKeyId_workspaceId_key" ON "ApiKeyEnvironment"("apiKeyId", "workspaceId");

-- Segment: @@unique([environmentId, title]) -> @@unique([workspaceId, title])
DROP INDEX "Segment_environmentId_title_key";
CREATE UNIQUE INDEX "Segment_workspaceId_title_key" ON "Segment"("workspaceId", "title");
