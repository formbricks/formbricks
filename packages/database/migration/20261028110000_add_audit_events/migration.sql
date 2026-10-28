-- Persisted audit events (agent-first experiment, ADR 0015): one new, empty "AuditEvent" table, so an
-- organization owner or an agent holding `audit:read` can read back what was until now only written to the
-- application logger. Additive only: no existing table or column changes and no data moves.
--
-- One transaction for the whole file, which is also what makes it rerunnable: a rollback leaves nothing
-- behind to collide with on the retry. The table, indexes and foreign key are all created guarded, so the
-- file also converges on a database built with `db:push`.
--
-- `lock_timeout` is SET LOCAL so it expires with the transaction instead of leaking into the migrations
-- that run after this one on the same connection. The foreign key at the bottom locks "Organization",
-- which is a live table; failing fast is better than queueing behind a long-running query and holding the
-- lock queue open behind us.
--
-- The indexes are built on a table created in this same transaction, which is empty and invisible to every
-- other session, so building them concurrently would buy nothing.
--
-- "action", "actorType", "targetType" and "status" are TEXT, not enums: the audit vocabulary grows with
-- every feature and nothing joins on these columns. Every row is tied to its organization and removed with
-- it (ON DELETE CASCADE), like every other tenant table.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "status" TEXT NOT NULL,
    "eventId" TEXT,
    "apiUrl" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "changes" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditEvent_organizationId_timestamp_id_idx" ON "AuditEvent"("organizationId", "timestamp", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditEvent_organizationId_targetType_targetId_timestamp_id_idx" ON "AuditEvent"("organizationId", "targetType", "targetId", "timestamp", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditEvent_organizationId_actorId_timestamp_id_idx" ON "AuditEvent"("organizationId", "actorId", "timestamp", "id");

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
