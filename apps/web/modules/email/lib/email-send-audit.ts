import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  EMAIL_SEND_AUDIT_BUCKET,
  EMAIL_SEND_AUDIT_ENABLED,
  EMAIL_SEND_AUDIT_HMAC_KEY_ARN,
  EMAIL_SEND_AUDIT_KMS_KEY_ARN,
  SES_EMAIL_ENVIRONMENT,
} from "@/lib/constants";
import { hashEmailAuditUserId } from "./email-audit-identity";
import { reportEmailAuditFailure } from "./email-audit-monitoring";
import {
  deleteEmailAuditSnapshot,
  emailAuditObjectKey,
  getEmailAuditRecipientMac,
  putEmailAuditSnapshot,
} from "./email-audit-storage";
import type { TEmailType } from "./send-email";

export type TEmailAuditContext = Readonly<{
  trigger: "user" | "response" | "workflow" | "system";
  actorUserId?: string;
  configuredByUserId?: string;
  organizationId?: string;
  surveyId?: string;
  responseId?: string;
  followUpId?: string;
  workflowId?: string;
  workflowRunId?: string;
  inviteId?: string;
}>;

type TAuditState = Readonly<{ id: string; rowCreated: boolean; auditGap: boolean }>;

const contentTtlMs = 30 * 24 * 60 * 60 * 1000;
const metadataTtlMs = 90 * 24 * 60 * 60 * 1000;

const reportGap = (id: string, phase: string): Promise<void> =>
  reportEmailAuditFailure("email_audit_gap", { auditId: id, phase });

const emitMetadata = (
  id: string,
  emailType: TEmailType,
  context: TEmailAuditContext,
  status: string,
  auditGap: boolean,
  sesMessageHash?: string
): void => {
  // Explicit allowlist: no recipient address, subject, body, or SMTP response enters logs/SigNoz.
  logger.audit(
    {
      event: "outbound_email_audit",
      auditId: id,
      emailType,
      environment: SES_EMAIL_ENVIRONMENT,
      trigger: context.trigger,
      actorUserId: context.actorUserId,
      configuredByUserId: context.configuredByUserId,
      organizationId: context.organizationId,
      surveyId: context.surveyId,
      responseId: context.responseId,
      followUpId: context.followUpId,
      workflowId: context.workflowId,
      workflowRunId: context.workflowRunId,
      inviteId: context.inviteId,
      status,
      auditGap,
      sesMessageHash,
    },
    "Outbound email audit"
  );
};

export const beginEmailSendAudit = async (
  emailType: TEmailType,
  to: string,
  snapshot: Readonly<{ subject: string; html: string; text?: string }>,
  context: TEmailAuditContext
): Promise<TAuditState | null> => {
  if (!EMAIL_SEND_AUDIT_ENABLED) return null;
  const id = randomUUID();
  const now = Date.now();
  let recipientMac: string | undefined;
  let auditGap = false;
  try {
    recipientMac = await getEmailAuditRecipientMac(to, EMAIL_SEND_AUDIT_HMAC_KEY_ARN!);
  } catch {
    auditGap = true;
    await reportGap(id, "recipient_hmac");
  }

  let rowCreated = false;
  try {
    await prisma.outboundEmailAudit.create({
      data: {
        id,
        createdAt: new Date(now),
        environment: SES_EMAIL_ENVIRONMENT!,
        emailType,
        trigger: context.trigger,
        actorKind: context.actorUserId ? "user" : "system",
        actorUserId: context.actorUserId,
        configuredByUserId: context.configuredByUserId,
        actorUserHash: context.actorUserId ? hashEmailAuditUserId(context.actorUserId) : undefined,
        configuredByUserHash: context.configuredByUserId
          ? hashEmailAuditUserId(context.configuredByUserId)
          : undefined,
        organizationId: context.organizationId,
        surveyId: context.surveyId,
        responseId: context.responseId,
        followUpId: context.followUpId,
        workflowId: context.workflowId,
        workflowRunId: context.workflowRunId,
        inviteId: context.inviteId,
        recipientMac,
        snapshotKey: recipientMac ? emailAuditObjectKey(id) : null,
        auditGap: !recipientMac,
        expiresAt: new Date(now + metadataTtlMs),
        contentExpiresAt: new Date(now + contentTtlMs),
      },
    });
    rowCreated = true;
  } catch {
    auditGap = true;
    await reportGap(id, "ledger_create");
  }
  if (!rowCreated || !recipientMac) {
    emitMetadata(id, emailType, context, "prepared", auditGap);
    return { id, rowCreated, auditGap };
  }

  try {
    const saved = await putEmailAuditSnapshot(
      EMAIL_SEND_AUDIT_BUCKET!,
      EMAIL_SEND_AUDIT_KMS_KEY_ARN!,
      id,
      snapshot
    );
    const updated = await prisma.outboundEmailAudit.updateMany({
      where: { id, erasedAt: null },
      data: { snapshotSha256: saved.sha256 },
    });
    if (updated.count === 0) {
      // An erasure finished while S3 was writing. Do not recreate content for the erased row.
      await deleteEmailAuditSnapshot(EMAIL_SEND_AUDIT_BUCKET!, id);
    }
  } catch {
    auditGap = true;
    await reportGap(id, "snapshot_write");
    // A timed-out PutObject can still complete server-side. Keep the key in
    // the ledger for maintenance and attempt immediate idempotent deletion.
    try {
      await deleteEmailAuditSnapshot(EMAIL_SEND_AUDIT_BUCKET!, id);
    } catch {
      await reportEmailAuditFailure("email_audit_content_delete_failed", { auditId: id });
    }
    try {
      await prisma.outboundEmailAudit.update({ where: { id }, data: { auditGap: true } });
    } catch {
      await reportGap(id, "ledger_gap_update");
    }
  }
  emitMetadata(id, emailType, context, "prepared", auditGap);
  return { id, rowCreated, auditGap };
};

/** SES assigns this identifier after SMTP acceptance; RFC Message-ID is a separate header. */
export const sesMessageHashFromSendInfo = (sendInfo: unknown): string | undefined => {
  if (!sendInfo || typeof sendInfo !== "object") return;
  const info = sendInfo as Record<string, unknown>;
  let serverId: string | undefined;
  if (typeof info.serverMessageId === "string") {
    serverId = info.serverMessageId;
  } else if (typeof info.response === "string") {
    serverId = /\b250\s+Ok\s+([a-z0-9_-]+)\b/i.exec(info.response)?.[1];
  }
  return serverId ? createHash("sha256").update(serverId).digest("hex") : undefined;
};

export const finishEmailSendAudit = async (
  state: TAuditState | null,
  emailType: TEmailType,
  context: TEmailAuditContext,
  status: "accepted" | "failed",
  sendInfo?: unknown
): Promise<void> => {
  if (!state) return;
  const sesMessageHash = status === "accepted" ? sesMessageHashFromSendInfo(sendInfo) : undefined;
  let auditGap = state.auditGap || (status === "accepted" && !sesMessageHash);
  if (state.rowCreated) {
    try {
      const updated = await prisma.outboundEmailAudit.updateMany({
        where: { id: state.id, erasedAt: null, erasureRequestedAt: null },
        data: {
          status,
          statusRecordedAt: new Date(),
          sesMessageHash,
          ...(auditGap ? { auditGap: true } : {}),
        },
      });
      if (updated.count === 0) return;
    } catch {
      auditGap = true;
      await reportGap(state.id, "ledger_finish");
    }
  }
  if (status === "accepted" && !sesMessageHash) await reportGap(state.id, "ses_message_id_missing");
  emitMetadata(state.id, emailType, context, status, auditGap, sesMessageHash);
};
