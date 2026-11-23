-- Workflows Part 2, run data retention (ENG-7186, ADR 0044). Additive only: an index on "WorkflowRun"
-- ("contentDeletedAt", "finishedAt") so each batch of the retention job finds the runs still to clear
-- (`"contentDeletedAt" IS NULL AND "finishedAt" < cutoff`) without scanning every run. The columns come from
-- the previous migration, 20261113140000_workflows_p2_run_retention. Guarded so the file reruns on a
-- database built with `db:push`.
--
-- Built concurrently, so run writes never wait for it. Prisma sends each statement of this file on its own,
-- outside a transaction, which CONCURRENTLY needs (packages/database/README.md, "How Prisma applies a
-- migration file"). `lock_timeout = 0` lets the build wait for older transactions instead of failing and
-- leaving an INVALID index that `IF NOT EXISTS` would skip on a retry.
SET lock_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WorkflowRun_contentDeletedAt_finishedAt_idx" ON "WorkflowRun"("contentDeletedAt", "finishedAt");

RESET lock_timeout;
