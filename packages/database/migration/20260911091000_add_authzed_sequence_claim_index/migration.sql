-- Keep the original createdAt claim index for age-based freshness checks. This second partial index
-- serves the activation watermark order. NULLS FIRST guarantees that every legacy row is drained
-- before sequenced writes at or below the recorded cutover watermark.
--
-- This file deliberately contains one statement: Prisma sends multi-statement migrations through a
-- transaction block, while PostgreSQL requires a concurrent index build to be top-level. A preceding
-- SET lock_timeout would therefore make the migration invalid. IF NOT EXISTS is also deliberately
-- omitted because it would silently accept an invalid index left by an interrupted concurrent build.
-- If the build fails, remove that invalid index and resolve the failed Prisma migration before retrying.
-- squawk-ignore prefer-robust-stmts, require-lock-timeout
CREATE INDEX CONCURRENTLY "AuthzedProjectionOutbox_sequence_claim_idx"
  ON "AuthzedProjectionOutbox"(
    "isRevocation" DESC,
    "sourceSequence" ASC NULLS FIRST,
    "createdAt" ASC,
    "id" ASC
  )
  WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL;
