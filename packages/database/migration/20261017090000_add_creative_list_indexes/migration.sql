-- Indexes for the creatives list sorts and the environment payload order (review fix S2). The list sorts a
-- workspace's creatives by "updated_at" (already indexed), "created_at" or "name" with a keyset page, and
-- the environment payload reads a workspace's newest creatives first, so each sort gets a
-- ("workspaceId", <sort column>) index.
--
-- "Creative" is new in this release (20261016150000_add_creatives), so it holds at most the few rows a
-- workspace made since the upgrade: a plain build in one short transaction holds its writes for
-- milliseconds, and CONCURRENTLY can't run inside a transaction. `IF NOT EXISTS` keeps a re-run, or a
-- database built with `db:push`, a no-op.
BEGIN;
SET LOCAL lock_timeout = '1s';

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "Creative_workspaceId_created_at_idx" ON "Creative"("workspaceId", "created_at");

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "Creative_workspaceId_name_idx" ON "Creative"("workspaceId", "name");

COMMIT;
