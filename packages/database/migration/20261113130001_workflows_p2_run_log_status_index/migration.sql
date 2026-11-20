-- Workflows Part 2, HTTP request (ENG-7179, ADR 0043). Additive only: an index on "WorkflowRunLog"
-- ("status", "startedAt") so the reconciler can find "Don't wait" calls still sending after an hour without
-- scanning every step log. Previous-release pods never rely on it. Guarded so the file reruns on a database
-- built with `db:push`.
--
-- Built concurrently, so step log writes never wait for it. Prisma sends each statement of this file on its
-- own, outside a transaction, which CONCURRENTLY needs (packages/database/README.md, "How Prisma applies a
-- migration file"). `lock_timeout = 0` lets the build wait for older transactions instead of failing and
-- leaving an INVALID index that `IF NOT EXISTS` would skip on a retry.
SET lock_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WorkflowRunLog_status_startedAt_idx" ON "WorkflowRunLog"("status", "startedAt");

RESET lock_timeout;
