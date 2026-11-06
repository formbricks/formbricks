-- ENG-6932: rules before the first question. Nullable JSON with no default, so nothing is
-- backfilled: null means "no rules" and every existing survey starts exactly as before.
-- `IF NOT EXISTS` keeps a re-run, or a database created with `db:push`, a no-op.
SET lock_timeout = '1s';

-- AlterTable
ALTER TABLE "Survey"
  ADD COLUMN IF NOT EXISTS "startLogic" JSONB;

RESET lock_timeout;
