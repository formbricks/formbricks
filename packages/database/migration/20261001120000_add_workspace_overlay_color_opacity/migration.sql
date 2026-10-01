-- AlterTable
-- Nullable with no default, so nothing is backfilled: null means the preset for `overlay`.
-- `IF NOT EXISTS` keeps a re-run, or a database created with `db:push`, a no-op.
SET lock_timeout = '1s';

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "overlayColor" TEXT,
  ADD COLUMN IF NOT EXISTS "overlayOpacity" INTEGER;

RESET lock_timeout;
