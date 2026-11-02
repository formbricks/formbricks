import "server-only";
import { prisma } from "@formbricks/database";
import type { JobHandler, TGlobalScopeJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { EMAIL_SEND_AUDIT_BUCKET, EMAIL_SEND_AUDIT_HMAC_KEY_ARN } from "@/lib/constants";
import { reportEmailAuditFailure } from "./email-audit-monitoring";
import { deleteEmailAuditSnapshot, getEmailAuditRecipientMac } from "./email-audit-storage";

const batchSize = 100;
const inFlightWriteGraceMs = 60_000;

const getRecipientMacForErasure = async (email: string): Promise<string> => {
  if (!EMAIL_SEND_AUDIT_HMAC_KEY_ARN) {
    throw new Error("recipient_hmac_config");
  }
  try {
    return await getEmailAuditRecipientMac(email, EMAIL_SEND_AUDIT_HMAC_KEY_ARN);
  } catch {
    throw new Error("recipient_hmac");
  }
};

/** Called after a customer-data deletion; the maintenance job retries object erasure until it succeeds. */
export const requestEmailAuditErasure = async (scope: {
  organizationId?: string;
  surveyId?: string;
  responseId?: string;
  responseIds?: string[];
  userId?: string;
  email?: string;
}): Promise<void> => {
  // The audit store is intentionally absent from KSA and self-hosted deployments.
  // EU rollback keeps the bucket configuration while disabling new writes.
  if (!EMAIL_SEND_AUDIT_BUCKET) return;
  let recipientMac: string | undefined;
  let recipientError: Error | undefined;
  if (scope.email) {
    try {
      recipientMac = await getRecipientMacForErasure(scope.email);
    } catch (error) {
      recipientError = error instanceof Error ? error : new Error("recipient_hmac");
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
  const responseIds = scope.responseIds ?? [];
  if (conditions.length === 0 && responseIds.length === 0) {
    if (recipientError) throw recipientError;
    return;
  }
  const requestedAt = new Date();
  if (conditions.length > 0) {
    await prisma.outboundEmailAudit.updateMany({
      where: { OR: conditions, erasedAt: null },
      data: { erasureRequestedAt: requestedAt },
    });
  }
  for (let index = 0; index < responseIds.length; index += 500) {
    await prisma.outboundEmailAudit.updateMany({
      where: { responseId: { in: responseIds.slice(index, index + 500) }, erasedAt: null },
      data: { erasureRequestedAt: requestedAt },
    });
  }
  if (recipientError) throw recipientError;
};

export const requestEmailAuditErasureBestEffort = async (
  scope: Parameters<typeof requestEmailAuditErasure>[0]
) => {
  try {
    await requestEmailAuditErasure(scope);
  } catch (error) {
    const phase =
      error instanceof Error && error.message.startsWith("recipient_hmac") ? error.message : undefined;
    await reportEmailAuditFailure("email_audit_erasure_request_failed", { phase });
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
        // Let a concurrent S3 PutObject settle before deleting its object.
        { erasureRequestedAt: { lte: new Date(now.getTime() - inFlightWriteGraceMs) }, erasedAt: null },
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
