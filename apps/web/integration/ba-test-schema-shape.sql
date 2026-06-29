-- Better Auth integration test-schema shape (ENG-1054).
--
-- The dev/migrated schema stores emailVerified as a nullable timestamp and Account.type as NOT NULL;
-- Better Auth needs emailVerified as a non-null boolean and an optional Account.type (the cutover
-- conversion). This patch is applied to the throwaway integration database (formbricks_ba_test) by
-- BOTH callers so they always provision the identical shape:
--   - local:  apps/web/integration/global-setup.ts (after the docker schema clone)
--   - CI:     .github/workflows/integration-tests.yml (after `db:migrate:dev`)
-- Keep this the single source of truth — do not inline these ALTERs in either caller.
ALTER TABLE "User" ALTER COLUMN email_verified DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN email_verified TYPE boolean USING (email_verified IS NOT NULL);
ALTER TABLE "User" ALTER COLUMN email_verified SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN email_verified SET NOT NULL;
ALTER TABLE "Account" ALTER COLUMN type DROP NOT NULL;
