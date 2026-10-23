-- ENG-2949: custom CSS storage. Nullable JSON with no default, so nothing is backfilled: null means
-- "no custom CSS" and existing workspaces and surveys render exactly as before.
-- `IF NOT EXISTS` keeps a re-run, or a database created with `db:push`, a no-op.
SET lock_timeout = '1s';

-- AlterTable
ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "customCss" JSONB,
  ADD COLUMN IF NOT EXISTS "customCssPrevious" JSONB;

-- AlterTable
ALTER TABLE "Survey"
  ADD COLUMN IF NOT EXISTS "customCss" JSONB;

RESET lock_timeout;
