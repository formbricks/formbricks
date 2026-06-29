-- Better Auth integration test-schema shape (ENG-1054).
--
-- In the dev/migrated schema the emailVerified column is a nullable timestamp and the Account type
-- column is required. Better Auth instead expects a non-null boolean emailVerified and an optional
-- Account type (the cutover conversion). This file is the single source of truth for that shape and is
-- applied to the throwaway integration database (formbricks_ba_test) by both callers, so local and CI
-- provision it identically:
--   local: apps/web/integration/global-setup.ts (after the docker schema clone)
--   CI: .github/workflows/integration-tests.yml (after the db migrate step)
-- Do not duplicate the statements below in either caller.
ALTER TABLE "User" ALTER COLUMN email_verified DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN email_verified TYPE boolean USING (email_verified IS NOT NULL);
ALTER TABLE "User" ALTER COLUMN email_verified SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN email_verified SET NOT NULL;
ALTER TABLE "Account" ALTER COLUMN type DROP NOT NULL;
