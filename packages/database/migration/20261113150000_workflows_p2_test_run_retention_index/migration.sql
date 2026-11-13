-- Workflows Part 2, Test run retention (ENG-7186). Additive only: an index on ("isDryRun", "createdAt") so
-- each batch of the retention job finds the Test runs to delete (`"isDryRun" AND "createdAt" < cutoff`,
-- oldest first) without scanning every dry run. The existing "isDryRun" index stays. Guarded so the file
-- reruns on a database built with `db:push`.

-- Prisma migrate deploy runs migrations in a transaction, so CREATE INDEX CONCURRENTLY is not available.
-- Run writes wait for the build (SHARE lock); the table holds one row per workflow run, far smaller than
-- the Response tables earlier plain index builds were accepted on.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "WorkflowRun_isDryRun_created_at_idx" ON "WorkflowRun"("isDryRun", "created_at");
