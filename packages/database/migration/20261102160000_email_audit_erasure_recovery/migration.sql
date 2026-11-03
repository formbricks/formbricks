BEGIN;
SET LOCAL lock_timeout = '1s';

ALTER TABLE "OutboundEmailAudit"
    ADD COLUMN "actorUserHash" TEXT,
    ADD COLUMN "configuredByUserHash" TEXT,
    ADD COLUMN "contentDeleteRetryAt" TIMESTAMP(3),
    ADD COLUMN "contentDeleteFailures" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "OutboundEmailAuditErasureIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userHash" TEXT NOT NULL,
    "recipientMac" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboundEmailAuditErasureIntent_pkey" PRIMARY KEY ("id")
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX "OutboundEmailAudit_contentDeleteRetryAt_id_idx" ON "OutboundEmailAudit"("contentDeleteRetryAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX "OutboundEmailAudit_actorUserHash_createdAt_id_idx" ON "OutboundEmailAudit"("actorUserHash", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX "OutboundEmailAudit_configuredByUserHash_createdAt_id_idx" ON "OutboundEmailAudit"("configuredByUserHash", "createdAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX "OutboundEmailAuditErasureIntent_userId_idx" ON "OutboundEmailAuditErasureIntent"("userId");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX "OutboundEmailAuditErasureIntent_recipientMac_activatedAt_idx" ON "OutboundEmailAuditErasureIntent"("recipientMac", "activatedAt");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX "OutboundEmailAuditErasureIntent_userHash_activatedAt_idx" ON "OutboundEmailAuditErasureIntent"("userHash", "activatedAt");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX "OutboundEmailAuditErasureIntent_checkedAt_id_idx" ON "OutboundEmailAuditErasureIntent"("checkedAt", "id");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX "OutboundEmailAuditErasureIntent_expiresAt_idx" ON "OutboundEmailAuditErasureIntent"("expiresAt");

COMMIT;
