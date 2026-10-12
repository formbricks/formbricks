-- AlterTable
-- Nullable with no default, so nothing is backfilled: null on existing surveys reads as "off".
-- `IF NOT EXISTS` keeps a re-run, or a database created with `db:push`, a no-op.
SET lock_timeout = '1s';

ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "autoSelectLanguage" BOOLEAN;

RESET lock_timeout;
