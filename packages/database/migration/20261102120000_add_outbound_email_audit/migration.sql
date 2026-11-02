-- New table is empty, so standard indexes build without blocking existing writes.
-- Prisma applies this file transactionally; CONCURRENTLY cannot run in the transaction.
BEGIN;
SET LOCAL lock_timeout = '1s';

CREATE TABLE IF NOT EXISTS "OutboundEmailAudit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "contentExpiresAt" TIMESTAMP(3) NOT NULL,
    "environment" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorUserId" TEXT,
    "configuredByUserId" TEXT,
    "organizationId" TEXT,
    "surveyId" TEXT,
    "responseId" TEXT,
    "followUpId" TEXT,
    "workflowId" TEXT,
    "workflowRunId" TEXT,
    "inviteId" TEXT,
    "recipientMac" TEXT,
    "sesMessageHash" TEXT,
    "snapshotKey" TEXT,
    "snapshotSha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "statusRecordedAt" TIMESTAMP(3),
    "auditGap" BOOLEAN NOT NULL DEFAULT false,
    "erasureRequestedAt" TIMESTAMP(3),
    "erasedAt" TIMESTAMP(3),
    CONSTRAINT "OutboundEmailAudit_pkey" PRIMARY KEY ("id")
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_environment_createdAt_id_idx" ON "OutboundEmailAudit"("environment", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_organizationId_createdAt_id_idx" ON "OutboundEmailAudit"("organizationId", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_surveyId_createdAt_id_idx" ON "OutboundEmailAudit"("surveyId", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_responseId_createdAt_id_idx" ON "OutboundEmailAudit"("responseId", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_actorUserId_createdAt_id_idx" ON "OutboundEmailAudit"("actorUserId", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_configuredByUserId_createdAt_id_idx" ON "OutboundEmailAudit"("configuredByUserId", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_recipientMac_createdAt_id_idx" ON "OutboundEmailAudit"("recipientMac", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_sesMessageHash_idx" ON "OutboundEmailAudit"("sesMessageHash");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_status_createdAt_id_idx" ON "OutboundEmailAudit"("status", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_contentExpiresAt_id_idx" ON "OutboundEmailAudit"("contentExpiresAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_expiresAt_id_idx" ON "OutboundEmailAudit"("expiresAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "OutboundEmailAudit_erasureRequestedAt_id_idx" ON "OutboundEmailAudit"("erasureRequestedAt", "id");

COMMIT;
