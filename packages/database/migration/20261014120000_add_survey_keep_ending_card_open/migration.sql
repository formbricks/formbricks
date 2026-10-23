-- AlterTable
-- Defaults to false, so existing surveys keep closing 3 seconds after the ending card. A constant
-- default makes this a metadata-only change on PostgreSQL 11+, with no table rewrite.
-- `IF NOT EXISTS` keeps a re-run, or a database created with `db:push`, a no-op.
SET lock_timeout = '1s';

ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "keepEndingCardOpen" BOOLEAN NOT NULL DEFAULT false;

RESET lock_timeout;
