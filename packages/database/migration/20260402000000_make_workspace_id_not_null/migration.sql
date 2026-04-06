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
