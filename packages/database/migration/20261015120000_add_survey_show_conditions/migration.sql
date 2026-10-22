-- ENG-3873: survey show conditions. Nullable JSON with no default, so nothing is backfilled: null
-- means "no conditions" and every existing survey shows exactly as before.
-- `IF NOT EXISTS` keeps a re-run, or a database created with `db:push`, a no-op.
SET lock_timeout = '1s';

-- AlterTable
ALTER TABLE "Survey"
  ADD COLUMN IF NOT EXISTS "showConditions" JSONB;

RESET lock_timeout;
