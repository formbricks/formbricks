-- Workflows Part 2, Test run retention (ENG-7186). Additive only: an index on ("isDryRun", "createdAt") so
-- each batch of the retention job finds the Test runs to delete (`"isDryRun" AND "createdAt" < cutoff`,
-- oldest first) without scanning every dry run. The existing "isDryRun" index stays. Guarded so the file
-- reruns on a database built with `db:push`.
--
-- Built concurrently, so run writes never wait for it. Prisma sends each statement of this file on its own,
-- outside a transaction, which CONCURRENTLY needs (packages/database/README.md, "How Prisma applies a
-- migration file"). `lock_timeout = 0` lets the build wait for older transactions instead of failing and
-- leaving an INVALID index that `IF NOT EXISTS` would skip on a retry.
SET lock_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WorkflowRun_isDryRun_created_at_idx" ON "WorkflowRun"("isDryRun", "created_at");

RESET lock_timeout;
