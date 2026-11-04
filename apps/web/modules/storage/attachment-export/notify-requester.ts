import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZUserLocale } from "@formbricks/types/user";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { loggableError } from "@/lib/utils/loggable-error";
import {
  type TAttachmentExportFailureReason,
  sendAttachmentExportFailedEmail,
  sendAttachmentExportReadyEmail,
} from "@/modules/email";
import { ATTACHMENT_EXPORT_RETENTION_MONTHS, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_FILES } from "./constants";
import { formatArchiveSize } from "./lib/format-archive-size";
import type { TAttachmentExportErrorCode } from "./types";

/**
 * Tells the user who started an attachment export how it ended (ENG-6862): a download link when it is
 * ready, a nudge to start again when it failed. The email is the only way the export reaches them, since
 * the app does not keep a list of exports.
 *
 * Never throws. The export has already settled when this runs, so a send that keeps failing is logged
 * rather than turning a finished archive into a failed job. A requester whose account is gone gets nothing.
 */

type TNotifyScope = { attachmentExportId: string; workspaceId: string };

const loadRecipient = async ({ attachmentExportId, workspaceId }: TNotifyScope) => {
  const row = await prisma.attachmentExport.findFirst({
    where: { id: attachmentExportId, workspaceId },
    select: {
      requestedBy: { select: { id: true, email: true, locale: true } },
      survey: { select: { id: true, name: true } },
      workspace: { select: { organizationId: true } },
    },
  });
  if (!row?.requestedBy) return null;
  return {
    recipient: {
      userId: row.requestedBy.id,
      email: row.requestedBy.email,
      locale: ZUserLocale.catch("en-US").parse(row.requestedBy.locale),
      organizationId: row.workspace.organizationId,
      surveyId: row.survey.id,
      surveyName: row.survey.name,
    },
  };
};

/** "February 3, 2027" in the reader's language, on the calendar of the organization's time zone. */
const formatExpiryDate = (expiresAt: Date, locale: string, timeZone: string): string => {
  try {
    return formatDateForDisplay(expiresAt, locale, { dateStyle: "long", timeZone });
  } catch {
    // An unknown zone name throws; the date in UTC is at most a day off.
    return formatDateForDisplay(expiresAt, locale, { dateStyle: "long", timeZone: "UTC" });
  }
};

const formatCount = (count: number, locale: string): string => new Intl.NumberFormat(locale).format(count);

/**
 * What the failure email tells the requester to do. Only causes the requester can act on get their own
 * advice; the rest (storage, a lost job, a bug) read as "something went wrong, start it again".
 */
const toFailureReason = (errorCode: TAttachmentExportErrorCode): TAttachmentExportFailureReason => {
  switch (errorCode) {
    case "too_many_files":
    case "build_timeout":
    case "no_attachments":
      return errorCode;
    default:
      return "other";
  }
};

/**
 * Waits before each retry of a send that threw: a mail server hiccup usually passes within seconds. Once
 * these run out the failure is logged and the requester is not told; they can start the export again.
 */
export const NOTIFY_RETRY_DELAYS_MS = [5_000, 30_000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const send = async (scope: TNotifyScope, outcome: string, deliver: () => Promise<boolean>) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const sent = await deliver();
      // SMTP is not configured: no retry can change that.
      if (!sent) {
        logger.warn(
          { attachmentExportId: scope.attachmentExportId, outcome },
          "Attachment export email not sent: SMTP is not configured"
        );
      }
      return;
    } catch (error) {
      const delay = NOTIFY_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        logger.error(
          { attachmentExportId: scope.attachmentExportId, outcome, err: loggableError(error) },
          "Failed to send attachment export email"
        );
        return;
      }
      logger.warn(
        {
          attachmentExportId: scope.attachmentExportId,
          outcome,
          attempt: attempt + 1,
          err: loggableError(error),
        },
        "Attachment export email failed; retrying"
      );
      await sleep(delay);
    }
  }
};

export const notifyAttachmentExportReady = async (
  scope: TNotifyScope & {
    archiveBytes: number;
    /** Files the export covered, and how many of them the archive holds. */
    fileCount: number;
    includedFileCount: number;
    expiresAt: Date;
    truncated: boolean;
    timeZone: string;
  }
): Promise<void> => {
  await send(scope, "ready", async () => {
    const loaded = await loadRecipient(scope);
    if (!loaded) return true;
    const { recipient } = loaded;
    return await sendAttachmentExportReadyEmail({
      ...recipient,
      attachmentExportId: scope.attachmentExportId,
      archiveSize: formatArchiveSize(scope.archiveBytes, recipient.locale),
      fileCount: formatCount(scope.fileCount, recipient.locale),
      includedFileCount: formatCount(scope.includedFileCount, recipient.locale),
      sizeLimit: formatArchiveSize(MAX_ATTACHMENT_BYTES, recipient.locale),
      retentionMonths: formatCount(ATTACHMENT_EXPORT_RETENTION_MONTHS, recipient.locale),
      expiryDate: formatExpiryDate(scope.expiresAt, recipient.locale, scope.timeZone),
      truncated: scope.truncated,
    });
  });
};

export const notifyAttachmentExportFailed = async (
  scope: TNotifyScope & { errorCode: TAttachmentExportErrorCode }
): Promise<void> => {
  await send(scope, "failed", async () => {
    const loaded = await loadRecipient(scope);
    if (!loaded) return true;
    const { recipient } = loaded;
    return await sendAttachmentExportFailedEmail({
      ...recipient,
      workspaceId: scope.workspaceId,
      reason: toFailureReason(scope.errorCode),
      maxFiles: formatCount(MAX_ATTACHMENT_FILES, recipient.locale),
    });
  });
};
