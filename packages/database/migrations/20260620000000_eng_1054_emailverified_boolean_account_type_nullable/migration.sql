-- ENG-1054 cutover (BREAKING): convert User.emailVerified Date -> Boolean, and make Account.type
-- nullable. Better Auth stores emailVerified as a boolean and creates Account rows without a `type`.
--
-- Ordering: runs in the flip deploy AFTER the credential-account backfill
-- (20260619120000_eng_1054_credential_account_backfill, which inserts Account rows with a NOT NULL
-- `type`) and the 2FA re-encode script. NextAuth is removed in the same deploy, so nothing reads
-- emailVerified as a Date afterwards.
--
-- ROLLBACK SAFETY: the original verification timestamps are copied into "email_verified_at" before
-- the lossy boolean conversion, so a deploy rollback (which restores NextAuth and expects a DateTime)
-- can recover them. This temp column is intentionally NOT in schema.prisma; a follow-up migration
-- drops it once the rollback bake window has passed.

-- Preserve the original verification timestamps for rollback.
ALTER TABLE "public"."User" ADD COLUMN "email_verified_at" TIMESTAMP(3);
UPDATE "public"."User" SET "email_verified_at" = "email_verified";

-- Convert emailVerified DateTime? -> Boolean NOT NULL DEFAULT false (verified in the integration harness).
ALTER TABLE "public"."User" ALTER COLUMN "email_verified" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "email_verified" TYPE BOOLEAN USING ("email_verified" IS NOT NULL);
ALTER TABLE "public"."User" ALTER COLUMN "email_verified" SET DEFAULT false;
ALTER TABLE "public"."User" ALTER COLUMN "email_verified" SET NOT NULL;

-- Better Auth-created Account rows set no `type` (today it is NextAuth-required / NOT NULL).
ALTER TABLE "public"."Account" ALTER COLUMN "type" DROP NOT NULL;
