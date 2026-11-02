CREATE TABLE "OutboundEmailAudit" (
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
    "auditGap" BOOLEAN NOT NULL DEFAULT false,
    "erasureRequestedAt" TIMESTAMP(3),
    "erasedAt" TIMESTAMP(3),
    CONSTRAINT "OutboundEmailAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboundEmailAudit_environment_createdAt_id_idx" ON "OutboundEmailAudit"("environment", "createdAt", "id");
CREATE INDEX "OutboundEmailAudit_organizationId_createdAt_id_idx" ON "OutboundEmailAudit"("organizationId", "createdAt", "id");
CREATE INDEX "OutboundEmailAudit_surveyId_createdAt_id_idx" ON "OutboundEmailAudit"("surveyId", "createdAt", "id");
CREATE INDEX "OutboundEmailAudit_responseId_createdAt_id_idx" ON "OutboundEmailAudit"("responseId", "createdAt", "id");
CREATE INDEX "OutboundEmailAudit_actorUserId_createdAt_id_idx" ON "OutboundEmailAudit"("actorUserId", "createdAt", "id");
CREATE INDEX "OutboundEmailAudit_configuredByUserId_createdAt_id_idx" ON "OutboundEmailAudit"("configuredByUserId", "createdAt", "id");
CREATE INDEX "OutboundEmailAudit_recipientMac_createdAt_id_idx" ON "OutboundEmailAudit"("recipientMac", "createdAt", "id");
CREATE INDEX "OutboundEmailAudit_sesMessageHash_idx" ON "OutboundEmailAudit"("sesMessageHash");
CREATE INDEX "OutboundEmailAudit_status_createdAt_id_idx" ON "OutboundEmailAudit"("status", "createdAt", "id");
CREATE INDEX "OutboundEmailAudit_contentExpiresAt_id_idx" ON "OutboundEmailAudit"("contentExpiresAt", "id");
CREATE INDEX "OutboundEmailAudit_expiresAt_id_idx" ON "OutboundEmailAudit"("expiresAt", "id");
CREATE INDEX "OutboundEmailAudit_erasureRequestedAt_id_idx" ON "OutboundEmailAudit"("erasureRequestedAt", "id");
