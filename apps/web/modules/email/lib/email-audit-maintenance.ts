import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { JobHandler, TGlobalScopeJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { EMAIL_SEND_AUDIT_BUCKET, EMAIL_SEND_AUDIT_HMAC_KEY_ARN } from "@/lib/constants";
import { hashEmailAuditUserId } from "./email-audit-identity";
import { reportEmailAuditFailure } from "./email-audit-monitoring";
import { deleteEmailAuditSnapshot, getEmailAuditRecipientMac } from "./email-audit-storage";

const batchSize = 100;
const inFlightWriteGraceMs = 60_000;
const recipientIntentTtlMs = 90 * 24 * 60 * 60_000;
const contentDeleteInitialRetryMs = 15 * 60_000;

const erasureFailurePhase = (error: unknown): string | undefined => {
  if (!(error instanceof Error)) return;
  return error.message === "recipient_hmac" || error.message === "recipient_hmac_config"
    ? error.message
    : undefined;
};

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

type TEmailAuditErasureScope = {
  organizationId?: string;
  workspaceId?: string;
  surveyId?: string;
  responsesOfSurveyId?: string;
  responseId?: string;
  responseIds?: string[];
  userId?: string;
  email?: string;
};

const erasureConditions = (scope: TEmailAuditErasureScope, recipientMac?: string) =>
  [
    scope.organizationId ? { organizationId: scope.organizationId } : undefined,
    scope.surveyId ? { surveyId: scope.surveyId } : undefined,
    scope.responseId ? { responseId: scope.responseId } : undefined,
    scope.userId ? { actorUserId: scope.userId } : undefined,
    scope.userId ? { configuredByUserId: scope.userId } : undefined,
    recipientMac ? { recipientMac } : undefined,
  ].filter((condition) => condition !== undefined);

/** Marks matching rows for the maintenance job, which retries object erasure until it succeeds. */
export const requestEmailAuditErasure = async (
  scope: TEmailAuditErasureScope,
  client: Pick<Prisma.TransactionClient, "outboundEmailAudit" | "$executeRaw"> = prisma
): Promise<void> => {
  if (
    !scope.organizationId &&
    !scope.workspaceId &&
    !scope.surveyId &&
    !scope.responsesOfSurveyId &&
    !scope.responseId &&
    !scope.userId &&
    !scope.email &&
    !scope.responseIds?.length
  ) {
    return;
  }
  // The audit store is intentionally absent from KSA and self-hosted deployments.
  // EU rollback keeps the bucket configuration while disabling new writes.
  if (!EMAIL_SEND_AUDIT_BUCKET) {
    const existingRow = await client.outboundEmailAudit.findFirst({ select: { id: true } });
    if (existingRow) throw new Error("Email audit bucket configuration is missing while audit rows remain");
    return;
  }
  // A recipient lookup must succeed before any deletion can proceed. Callers
  // retaining that identity can retry; account deletion stops on failure.
  const recipientMac = scope.email ? await getRecipientMacForErasure(scope.email) : undefined;
  const conditions = erasureConditions(scope, recipientMac);
  const responseIds = scope.responseIds ?? [];
  if (
    conditions.length === 0 &&
    responseIds.length === 0 &&
    !scope.responsesOfSurveyId &&
    !scope.workspaceId
  ) {
    return;
  }
  const requestedAt = new Date();
  const erasureUpdate = { erasureRequestedAt: requestedAt, contentDeleteRetryAt: null };
  if (conditions.length > 0) {
    await client.outboundEmailAudit.updateMany({
      where: { OR: conditions, erasedAt: null },
      data: erasureUpdate,
    });
  }
  for (let index = 0; index < responseIds.length; index += 500) {
    await client.outboundEmailAudit.updateMany({
      where: { responseId: { in: responseIds.slice(index, index + 500) }, erasedAt: null },
      data: erasureUpdate,
    });
  }
  // These relationships vanish when their source rows are deleted. Match them
  // inside the source deletion transaction, without loading unbounded ID lists.
  if (scope.responsesOfSurveyId) {
    await client.$executeRaw`
      UPDATE "OutboundEmailAudit" a
      SET "erasureRequestedAt" = ${requestedAt}, "contentDeleteRetryAt" = NULL, "updatedAt" = ${requestedAt}
      WHERE a."responseId" IN (SELECT r."id" FROM "Response" r WHERE r."surveyId" = ${scope.responsesOfSurveyId})
        AND a."erasedAt" IS NULL
    `;
  }
  if (scope.workspaceId) {
    await client.$executeRaw`
      UPDATE "OutboundEmailAudit" a
      SET "erasureRequestedAt" = ${requestedAt}, "contentDeleteRetryAt" = NULL, "updatedAt" = ${requestedAt}
      WHERE (a."surveyId" IN (SELECT s."id" FROM "Survey" s WHERE s."workspaceId" = ${scope.workspaceId})
        OR a."responseId" IN (
          SELECT r."id" FROM "Response" r JOIN "Survey" s ON s."id" = r."surveyId"
          WHERE s."workspaceId" = ${scope.workspaceId}
        )) AND a."erasedAt" IS NULL
    `;
  }
  if (scope.organizationId) {
    await client.$executeRaw`
      UPDATE "OutboundEmailAudit" a
      SET "erasureRequestedAt" = ${requestedAt}, "contentDeleteRetryAt" = NULL, "updatedAt" = ${requestedAt}
      WHERE (a."surveyId" IN (
          SELECT s."id" FROM "Survey" s JOIN "Workspace" w ON w."id" = s."workspaceId"
          WHERE w."organizationId" = ${scope.organizationId}
        ) OR a."responseId" IN (
          SELECT r."id" FROM "Response" r
          JOIN "Survey" s ON s."id" = r."surveyId"
          JOIN "Workspace" w ON w."id" = s."workspaceId"
          WHERE w."organizationId" = ${scope.organizationId}
        )) AND a."erasedAt" IS NULL
    `;
  }
};

/** Keep the source deletion and erasure request in the same database transaction. */
export const requestEmailAuditErasureRequired = async (
  scope: Omit<TEmailAuditErasureScope, "email">,
  client: Pick<Prisma.TransactionClient, "outboundEmailAudit" | "$executeRaw">
) => {
  try {
    await requestEmailAuditErasure(scope, client);
  } catch (error) {
    await reportEmailAuditFailure("email_audit_erasure_request_failed", {
      phase: erasureFailurePhase(error),
    });
    throw error;
  }
};

/** Preserve recipient identity for retry by stopping account deletion if erasure cannot be queued. */
export const requestEmailAuditErasureBeforeUserDeletion = async (
  userId: string,
  email: string
): Promise<void> => {
  try {
    if (!EMAIL_SEND_AUDIT_BUCKET) {
      await requestEmailAuditErasure({ userId, email });
      return;
    }
    const recipientMac = await getRecipientMacForErasure(email);
    const requestedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.outboundEmailAuditErasureIntent.create({
        data: {
          userId,
          userHash: hashEmailAuditUserId(userId),
          recipientMac,
          expiresAt: new Date(requestedAt.getTime() + recipientIntentTtlMs),
        },
      });
      await requestEmailAuditErasure({ userId }, tx);
      await tx.outboundEmailAudit.updateMany({
        where: { recipientMac, erasedAt: null },
        data: { erasureRequestedAt: requestedAt, contentDeleteRetryAt: null },
      });
    });
  } catch (error) {
    await reportEmailAuditFailure("email_audit_erasure_request_failed", {
      phase: erasureFailurePhase(error),
    });
    throw new Error("Email audit erasure could not be prepared");
  }
};

/** A failed post-delete activation is recovered by the maintenance job once the user is absent. */
export const activateEmailAuditErasureIntent = async (userId: string): Promise<void> => {
  try {
    await prisma.outboundEmailAuditErasureIntent.updateMany({
      where: { userId, activatedAt: null },
      data: { userId: null, activatedAt: new Date() },
    });
  } catch {
    await reportEmailAuditFailure("email_audit_erasure_request_failed", { phase: "intent_activation" });
  }
};

const reconcileRecipientErasureIntents = async (now: Date): Promise<void> => {
  const pending = await prisma.$queryRaw<Array<{ id: string; userId: string }>>`
    SELECT "id", "userId" FROM "OutboundEmailAuditErasureIntent"
    WHERE "userId" IS NOT NULL AND "activatedAt" IS NULL AND "expiresAt" > ${now}
    ORDER BY "checkedAt" ASC NULLS FIRST, "id" ASC
    LIMIT ${batchSize}
  `;
  if (pending.length > 0) {
    const present = await prisma.user.findMany({
      where: { id: { in: pending.map((intent) => intent.userId) } },
      select: { id: true },
    });
    const presentIds = new Set(present.map((user) => user.id));
    const activatedIds = pending
      .filter((intent) => !presentIds.has(intent.userId))
      .map((intent) => intent.id);
    const stillPendingIds = pending
      .filter((intent) => presentIds.has(intent.userId))
      .map((intent) => intent.id);
    if (activatedIds.length > 0) {
      await prisma.outboundEmailAuditErasureIntent.updateMany({
        where: { id: { in: activatedIds } },
        data: { userId: null, activatedAt: now, checkedAt: now },
      });
    }
    if (stillPendingIds.length > 0) {
      await prisma.outboundEmailAuditErasureIntent.updateMany({
        where: { id: { in: stillPendingIds } },
        data: { checkedAt: now },
      });
    }
  }

  // createdAt is captured at send entry, before KMS or DB waits. An intent catches
  // late inserts for attempts started before deletion, without matching a new account's later sends.
  const marked = await prisma.$executeRaw`
    WITH late AS (
      SELECT a."id" FROM "OutboundEmailAudit" a
      JOIN "OutboundEmailAuditErasureIntent" i ON (
        i."recipientMac" = a."recipientMac" OR
        i."userHash" = a."actorUserHash" OR
        i."userHash" = a."configuredByUserHash"
      )
      WHERE i."activatedAt" IS NOT NULL AND i."expiresAt" > ${now}
        AND a."createdAt" <= i."activatedAt"
        AND a."erasureRequestedAt" IS NULL AND a."erasedAt" IS NULL
      ORDER BY a."id" ASC LIMIT ${batchSize}
    )
    UPDATE "OutboundEmailAudit" a
    SET "erasureRequestedAt" = ${now}, "contentDeleteRetryAt" = NULL, "updatedAt" = ${now}
    WHERE a."id" IN (SELECT "id" FROM late)
  `;
  if (marked === batchSize || pending.length === batchSize) {
    logger.warn({ event: "email_audit_erasure_intent_backlog" }, "Email audit erasure intent backlog");
  }
  await prisma.outboundEmailAuditErasureIntent.deleteMany({ where: { expiresAt: { lte: now } } });
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
          actorUserHash: null,
          configuredByUserHash: null,
          status: "erased",
          erasedAt: new Date(),
          erasureRequestedAt: null,
          contentDeleteRetryAt: null,
          contentDeleteFailures: 0,
        }
      : { snapshotKey: null, snapshotSha256: null, contentDeleteRetryAt: null, contentDeleteFailures: 0 },
  });
};

export const processEmailAuditMaintenanceJob: JobHandler<TGlobalScopeJobData> = async () => {
  if (!EMAIL_SEND_AUDIT_BUCKET) {
    const existingRow = await prisma.outboundEmailAudit.findFirst({ select: { id: true } });
    if (existingRow) {
      await reportEmailAuditFailure("email_audit_gap", { phase: "bucket_config" });
      throw new Error("Email audit bucket configuration is missing while audit rows remain");
    }
  }
  const now = new Date();
  try {
    await reconcileRecipientErasureIntents(now);
  } catch {
    await reportEmailAuditFailure("email_audit_erasure_request_failed", { phase: "intent_reconcile" });
    throw new Error("Email audit erasure intent reconciliation failed");
  }
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
      AND: [
        {
          OR: [
            // Let a concurrent S3 PutObject settle before deleting its object.
            { erasureRequestedAt: { lte: new Date(now.getTime() - inFlightWriteGraceMs) }, erasedAt: null },
            { contentExpiresAt: { lte: now }, snapshotKey: { not: null } },
          ],
        },
        { OR: [{ contentDeleteRetryAt: null }, { contentDeleteRetryAt: { lte: now } }] },
      ],
    },
    select: { id: true, snapshotKey: true, erasureRequestedAt: true, contentDeleteFailures: true },
    take: batchSize,
    orderBy: { id: "asc" },
  });
  for (const row of content) {
    try {
      await removeContent(row);
    } catch {
      await prisma.outboundEmailAudit.updateMany({
        where: { id: row.id, erasedAt: null },
        data: {
          contentDeleteFailures: { increment: 1 },
          contentDeleteRetryAt: new Date(
            now.getTime() +
              Math.min(
                24 * 60 * 60_000,
                contentDeleteInitialRetryMs * 2 ** Math.min(row.contentDeleteFailures, 7)
              )
          ),
        },
      });
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
