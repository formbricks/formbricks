BEGIN;
  -- Lock both tables to prevent any modifications during migration
  LOCK TABLE "ApiKey" IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE "ApiKeyNew" IN ACCESS EXCLUSIVE MODE;

  -- Verify all data is migrated before proceeding
  DO $$
  BEGIN
    IF (SELECT COUNT(*) FROM "ApiKey") != (SELECT COUNT(*) FROM "ApiKeyNew") THEN
      RAISE EXCEPTION 'Data migration incomplete. Counts do not match.';
    END IF;
  END $$;

  -- Drop the old ApiKey table first
  DROP TABLE IF EXISTS "ApiKey";

  -- Rename ApiKeyNew to ApiKey
  ALTER TABLE "ApiKeyNew" RENAME TO "ApiKey";
  ALTER TABLE "ApiKey" RENAME CONSTRAINT "ApiKeyNew_pkey" TO "ApiKey_pkey";
  ALTER INDEX "ApiKeyNew_hashedKey_key" RENAME TO "ApiKey_hashedKey_key";
  ALTER INDEX "ApiKeyNew_organizationId_idx" RENAME TO "ApiKey_organizationId_idx";

  -- Update the constraints to maintain foreign key relationships
  ALTER TABLE "ApiKeyEnvironment" DROP CONSTRAINT "ApiKeyEnvironment_apiKeyId_fkey";
  ALTER TABLE "ApiKeyEnvironment" ADD CONSTRAINT "ApiKeyEnvironment_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  -- Rename the foreign key constraint
  ALTER TABLE "ApiKey" DROP CONSTRAINT "ApiKeyNew_organizationId_fkey";
  ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;