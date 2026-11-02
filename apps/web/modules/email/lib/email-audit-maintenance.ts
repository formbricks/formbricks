import "server-only";
import { prisma } from "@formbricks/database";
import type { JobHandler, TGlobalScopeJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { EMAIL_SEND_AUDIT_BUCKET, EMAIL_SEND_AUDIT_HMAC_KEY_ARN } from "@/lib/constants";
import { reportEmailAuditFailure } from "./email-audit-monitoring";
import { deleteEmailAuditSnapshot, getEmailAuditRecipientMac } from "./email-audit-storage";

const batchSize = 100;

/** Called after a customer-data deletion; the maintenance job retries object erasure until it succeeds. */
export const requestEmailAuditErasure = async (scope: {
  organizationId?: string;
  surveyId?: string;
  responseId?: string;
  userId?: string;
  email?: string;
}): Promise<void> => {
  // The audit store is intentionally absent from KSA and self-hosted deployments.
  // EU rollback keeps the bucket configuration while disabling new writes.
  if (!EMAIL_SEND_AUDIT_BUCKET) return;
  let recipientMac: string | undefined;
  if (scope.email) {
    if (!EMAIL_SEND_AUDIT_HMAC_KEY_ARN) {
      await reportEmailAuditFailure("email_audit_erasure_request_failed", { phase: "recipient_hmac_config" });
    } else {
      try {
        recipientMac = await getEmailAuditRecipientMac(scope.email, EMAIL_SEND_AUDIT_HMAC_KEY_ARN);
      } catch {
        await reportEmailAuditFailure("email_audit_erasure_request_failed", { phase: "recipient_hmac" });
      }
    }
  }
  const conditions = [
    scope.organizationId ? { organizationId: scope.organizationId } : undefined,
    scope.surveyId ? { surveyId: scope.surveyId } : undefined,
    scope.responseId ? { responseId: scope.responseId } : undefined,
    scope.userId ? { actorUserId: scope.userId } : undefined,
    scope.userId ? { configuredByUserId: scope.userId } : undefined,
    recipientMac ? { recipientMac } : undefined,
  ].filter((condition) => condition !== undefined);
  if (conditions.length === 0) return;
  await prisma.outboundEmailAudit.updateMany({
    where: { OR: conditions, erasedAt: null },
    data: { erasureRequestedAt: new Date() },
  });
};

export const requestEmailAuditErasureBestEffort = async (
  scope: Parameters<typeof requestEmailAuditErasure>[0]
) => {
  try {
    await requestEmailAuditErasure(scope);
  } catch {
    await reportEmailAuditFailure("email_audit_erasure_request_failed", {});
  }
};

const removeContent = async (row: {
  id: string;
  snapshotKey: string | null;
  erasureRequestedAt: Date | null;
}) => {
  if (row.snapshotKey) {
    if (!EMAIL_SEND_AUDIT_BUCKET) throw new Error("Email audit bucket configuration is missing");
    await deleteEmailAuditSnapshot(EMAIL_SEND_AUDIT_BUCKET, row.id);
  }
  await prisma.outboundEmailAudit.updateMany({
    where: {
      id: row.id,
      snapshotKey: row.snapshotKey,
      erasureRequestedAt: row.erasureRequestedAt ? { not: null } : null,
      erasedAt: null,
    },
    data: row.erasureRequestedAt
      ? {
          snapshotKey: null,
          snapshotSha256: null,
          recipientMac: null,
          sesMessageHash: null,
          organizationId: null,
          surveyId: null,
          responseId: null,
          followUpId: null,
          workflowId: null,
          workflowRunId: null,
          inviteId: null,
          actorUserId: null,
          configuredByUserId: null,
          status: "erased",
          erasedAt: new Date(),
          erasureRequestedAt: null,
        }
      : { snapshotKey: null, snapshotSha256: null },
  });
};

export const processEmailAuditMaintenanceJob: JobHandler<TGlobalScopeJobData> = async () => {
  const now = new Date();
  const stale = await prisma.outboundEmailAudit.findMany({
    where: {
      status: "prepared",
      erasureRequestedAt: null,
      createdAt: { lt: new Date(now.getTime() - 15 * 60_000) },
    },
    select: { id: true },
    take: batchSize,
  });
  if (stale.length > 0) {
    await prisma.outboundEmailAudit.updateMany({
      where: { id: { in: stale.map((row) => row.id) }, status: "prepared" },
      data: { status: "indeterminate", statusRecordedAt: now, auditGap: true },
    });
    await reportEmailAuditFailure("email_audit_stale_prepared", { count: stale.length });
  }

  const content = await prisma.outboundEmailAudit.findMany({
    where: {
      OR: [
        { erasureRequestedAt: { not: null }, erasedAt: null },
        { contentExpiresAt: { lte: now }, snapshotKey: { not: null } },
      ],
    },
    select: { id: true, snapshotKey: true, erasureRequestedAt: true },
    take: batchSize,
    orderBy: { id: "asc" },
  });
  for (const row of content) {
    try {
      await removeContent(row);
    } catch {
      await reportEmailAuditFailure("email_audit_content_delete_failed", { auditId: row.id });
    }
  }

  const expired = await prisma.outboundEmailAudit.findMany({
    where: { expiresAt: { lte: now }, snapshotKey: null },
    select: { id: true },
    take: batchSize,
    orderBy: { id: "asc" },
  });
  if (expired.length > 0) {
    await prisma.outboundEmailAudit.deleteMany({ where: { id: { in: expired.map((row) => row.id) } } });
  }
  if (stale.length === batchSize || content.length === batchSize || expired.length === batchSize) {
    logger.warn(
      { event: "email_audit_maintenance_backlog" },
      "Email audit maintenance reached its batch cap"
    );
  }
};
