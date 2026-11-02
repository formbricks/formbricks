-- AlterTable
-- Opened by creative (ENG-4001, ADR 0006): the creative whose click opened the survey. Nullable with no
-- default, so this is a metadata-only change with no table rewrite on a table that grows with every
-- survey shown, and no foreign key, so the record survives the creative's deletion. No index: nothing
-- reads displays by creative yet; one would be built concurrently through the online-index mechanism.
-- `IF NOT EXISTS` keeps a re-run, or a database created with `db:push`, a no-op.
SET lock_timeout = '1s';

ALTER TABLE "Display" ADD COLUMN IF NOT EXISTS "creativeId" TEXT;

RESET lock_timeout;
