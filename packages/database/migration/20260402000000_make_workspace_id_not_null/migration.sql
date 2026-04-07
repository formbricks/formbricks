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

-- Migrate unique constraints from environmentId to workspaceId
-- (safe to run after dev environment promotion — no duplicates possible)

-- ContactAttributeKey: @@unique([key, environmentId]) -> @@unique([key, workspaceId])
ALTER TABLE "ContactAttributeKey" DROP CONSTRAINT "ContactAttributeKey_key_environmentId_key";
ALTER TABLE "ContactAttributeKey" ADD CONSTRAINT "ContactAttributeKey_key_workspaceId_key" UNIQUE ("key", "workspaceId");

-- Tag: @@unique([environmentId, name]) -> @@unique([workspaceId, name])
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_environmentId_name_key";
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_workspaceId_name_key" UNIQUE ("workspaceId", "name");

-- ActionClass: @@unique([key, environmentId]) -> @@unique([key, workspaceId])
ALTER TABLE "ActionClass" DROP CONSTRAINT "ActionClass_key_environmentId_key";
ALTER TABLE "ActionClass" ADD CONSTRAINT "ActionClass_key_workspaceId_key" UNIQUE ("key", "workspaceId");

-- ActionClass: @@unique([name, environmentId]) -> @@unique([name, workspaceId])
ALTER TABLE "ActionClass" DROP CONSTRAINT "ActionClass_name_environmentId_key";
ALTER TABLE "ActionClass" ADD CONSTRAINT "ActionClass_name_workspaceId_key" UNIQUE ("name", "workspaceId");

-- Integration: @@unique([type, environmentId]) -> @@unique([type, workspaceId])
ALTER TABLE "Integration" DROP CONSTRAINT "Integration_type_environmentId_key";
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_type_workspaceId_key" UNIQUE ("type", "workspaceId");

-- ApiKeyEnvironment: @@unique([apiKeyId, environmentId]) -> @@unique([apiKeyId, workspaceId])
ALTER TABLE "ApiKeyEnvironment" DROP CONSTRAINT "ApiKeyEnvironment_apiKeyId_environmentId_key";
ALTER TABLE "ApiKeyEnvironment" ADD CONSTRAINT "ApiKeyEnvironment_apiKeyId_workspaceId_key" UNIQUE ("apiKeyId", "workspaceId");

-- Segment: @@unique([environmentId, title]) -> @@unique([workspaceId, title])
ALTER TABLE "Segment" DROP CONSTRAINT "Segment_environmentId_title_key";
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_workspaceId_title_key" UNIQUE ("workspaceId", "title");
