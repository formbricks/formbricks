-- Keep the original createdAt claim index for age-based freshness checks. This second partial index
-- serves the activation watermark order. NULLS FIRST guarantees that every legacy row is drained
-- before sequenced writes at or below the recorded cutover watermark.
--
-- This file deliberately contains one statement: Prisma sends multi-statement migrations through a
-- transaction block, while PostgreSQL requires a concurrent index build to be top-level. If the
-- build fails, remove any invalid index and resolve the failed Prisma migration before retrying.
CREATE INDEX CONCURRENTLY "AuthzedProjectionOutbox_sequence_claim_idx"
  ON "AuthzedProjectionOutbox"(
    "isRevocation" DESC,
    "sourceSequence" ASC NULLS FIRST,
    "createdAt" ASC,
    "id" ASC
  )
  WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL;
