import "server-only";
import { PassThrough } from "node:stream";
import { prisma } from "@formbricks/database";
import { type JobHandler, type TAttachmentExportJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { deleteFile, uploadFileStream } from "@formbricks/storage";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { getSurvey } from "@/lib/survey/service";
import { loggableError } from "@/lib/utils/loggable-error";
import { collectResponseAttachments } from "@/modules/storage/lib/collect-response-attachments";
import { ATTACHMENT_EXPORT_MAX_BUILD_MS, MAX_ATTACHMENT_FILES, getAttachmentExportExpiry } from "./constants";
import {
  type AttachmentArchiveSummary,
  buildAttachmentArchiveFileName,
  createAttachmentArchive,
  writeAttachmentArchive,
} from "./export-attachments";
import { notifyAttachmentExportFailed, notifyAttachmentExportReady } from "./notify-requester";
import { buildAttachmentExportStorageKey } from "./storage-key";

/**
 * Builds one attachment export (ENG-6862): re-collects the survey's attachments with the filter stored at
 * request time, streams them into a ZIP and the ZIP into a multipart upload, then records what the
 * archive holds. The browser later downloads the object through a presigned URL.
 *
 * The archive is rebuilt from the first file on every attempt. Memory stays flat whatever the size: one
 * storage object is read at a time and the upload holds two 16 MB parts.
 *
 * Failures split three ways:
 * - Problems no retry can fix (survey gone, nothing to export, over the file cap) fail the export at once.
 * - Anything else on a non-final attempt is rethrown for BullMQ to retry; the row stays `running`, and the
 *   retry's claim accepts that.
 * - The final attempt writes `failed` and swallows, so the export never sits in progress forever.
 */

class AttachmentExportBuildError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean
  ) {
    super(`Attachment export failed: ${code}`);
    this.name = "AttachmentExportBuildError";
  }
}

const ARCHIVE_CONTENT_TYPE = "application/zip";

const buildArchiveAndUpload = async ({
  entries,
  storageKey,
  fileName,
}: {
  entries: Awaited<ReturnType<typeof collectResponseAttachments>>["entries"];
  storageKey: string;
  fileName: string;
}): Promise<AttachmentArchiveSummary & { archiveBytes: number }> => {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ATTACHMENT_EXPORT_MAX_BUILD_MS);

  const { archive, activeSource, destroyActiveSource } = createAttachmentArchive();

  // archiver's stream comes from `readable-stream`, not `node:stream`, and the SDK's upload rejects any
  // body that is not a Node `Readable` ("Body Data is unsupported format"). A PassThrough adapts it and
  // keeps backpressure: the upload reads at its own pace and the archive waits.
  const body = archive.pipe(new PassThrough());

  // A failed upload stops reading the archive, which would leave the writer waiting on an entry forever,
  // so either side failing aborts both.
  const uploaded = uploadFileStream(storageKey, body, {
    contentType: ARCHIVE_CONTENT_TYPE,
    // ASCII by construction (survey id and an ISO date), so no RFC 5987 `filename*` is needed.
    contentDisposition: `attachment; filename="${fileName}"`,
    signal: controller.signal,
  }).then((result) => {
    if (!result.ok) controller.abort();
    return result;
  });

  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () =>
        reject(new AttachmentExportBuildError(timedOut ? "build_timeout" : "storage_upload_failed", true)),
      { once: true }
    );
  });
  // Observed so an abort after the race has settled is not an unhandled rejection.
  aborted.catch(() => undefined);

  try {
    const summary = await Promise.race([writeAttachmentArchive(entries, archive, activeSource), aborted]);
    const upload = await uploaded;
    if (!upload.ok) {
      throw new AttachmentExportBuildError(timedOut ? "build_timeout" : "storage_upload_failed", true);
    }
    return { ...summary, archiveBytes: archive.pointer() };
  } catch (error) {
    destroyActiveSource();
    archive.abort();
    controller.abort();
    // Wait for the upload to wind down, so its multipart upload is aborted before the job moves on.
    await uploaded;
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const failExport = async (
  data: TAttachmentExportJobData,
  errorCode: string,
  storageKey: string | null
): Promise<void> => {
  const failed = await prisma.attachmentExport.updateMany({
    where: {
      id: data.attachmentExportId,
      workspaceId: data.workspaceId,
      status: { in: ["queued", "running"] },
    },
    data: { status: "failed", errorCode, finishedAt: new Date() },
  });
  // Only the attempt that settled the export tells the requester, so a re-run never emails twice.
  if (failed.count > 0) await notifyAttachmentExportFailed(data);
  if (storageKey) {
    // Normally nothing is there: a failed multipart upload is aborted. This covers an upload that
    // completed just before a later step failed. The reconcile job retries a failed delete.
    const deleted = await deleteFile(storageKey);
    if (deleted.ok) {
      await prisma.attachmentExport.updateMany({
        where: { id: data.attachmentExportId, workspaceId: data.workspaceId, status: "failed" },
        data: { storageKey: null },
      });
    }
  }
};

/**
 * Re-collects the export's attachments with the filter and time zone stored at request time. Throws a
 * non-retryable error for anything a retry cannot change.
 */
const collectExportEntries = async (
  row: { surveyId: string; filterCriteria: unknown; timeZone: string },
  workspaceId: string
) => {
  const survey = await getSurvey(row.surveyId);
  if (survey?.workspaceId !== workspaceId) {
    throw new AttachmentExportBuildError("survey_not_found", false);
  }

  const filter =
    row.filterCriteria === null ? undefined : ZResponseFilterCriteria.safeParse(row.filterCriteria);
  if (filter && !filter.success) {
    throw new AttachmentExportBuildError("invalid_filter", false);
  }

  const { entries, fileCount, exceedsMaxFiles } = await collectResponseAttachments({
    survey,
    filterCriteria: filter?.data,
    maxFiles: MAX_ATTACHMENT_FILES,
    timeZone: row.timeZone,
  });
  // Both were checked when the export was requested; responses can change while it waits in the queue.
  if (exceedsMaxFiles) throw new AttachmentExportBuildError("too_many_files", false);
  if (fileCount === 0) throw new AttachmentExportBuildError("no_attachments", false);

  return { survey, entries };
};

export const processAttachmentExportJob: JobHandler<TAttachmentExportJobData> = async (data, context) => {
  const logContext = {
    attachmentExportId: data.attachmentExportId,
    workspaceId: data.workspaceId,
    attempt: context.attempt,
    maxAttempts: context.maxAttempts,
    jobId: context.jobId,
  };

  const row = await prisma.attachmentExport.findFirst({
    where: { id: data.attachmentExportId, workspaceId: data.workspaceId },
    select: { surveyId: true, status: true, filterCriteria: true, timeZone: true, createdAt: true },
  });

  // `running` is claimable too: it is what a BullMQ retry (or a stalled job's re-run) finds.
  if (!row || (row.status !== "queued" && row.status !== "running")) {
    logger.info(
      { ...logContext, status: row?.status ?? null },
      "Attachment export is not claimable; skipping"
    );
    return;
  }

  const storageKey = buildAttachmentExportStorageKey({
    workspaceId: data.workspaceId,
    surveyId: row.surveyId,
    attachmentExportId: data.attachmentExportId,
  });

  // The key is recorded at claim, before anything is written, so a build killed mid-upload still leaves
  // the reconcile job a key to clean up.
  const claimed = await prisma.attachmentExport.updateMany({
    where: {
      id: data.attachmentExportId,
      workspaceId: data.workspaceId,
      status: { in: ["queued", "running"] },
    },
    data: { status: "running", startedAt: new Date(), storageKey, errorCode: null },
  });
  if (claimed.count === 0) {
    logger.info(logContext, "Attachment export was settled before it could be claimed; skipping");
    return;
  }

  try {
    const { survey, entries } = await collectExportEntries(row, data.workspaceId);

    const result = await buildArchiveAndUpload({
      entries,
      storageKey,
      fileName: buildAttachmentArchiveFileName(survey, row.createdAt),
    });

    const finishedAt = new Date();
    const expiresAt = getAttachmentExportExpiry(finishedAt);
    const completed = await prisma.attachmentExport.updateMany({
      where: { id: data.attachmentExportId, workspaceId: data.workspaceId, status: "running" },
      data: {
        status: "completed",
        includedFileCount: result.appendedFiles,
        totalBytes: BigInt(result.archiveBytes),
        truncated: result.truncated,
        finishedAt,
        expiresAt,
      },
    });

    if (completed.count === 0) {
      // Settled under us: failed as stale, or the survey and its exports were deleted. Nothing will ever
      // point at this archive, so it goes now.
      logger.warn(logContext, "Attachment export was settled while building; deleting its archive");
      await deleteFile(storageKey);
      return;
    }

    logger.info(
      { ...logContext, files: result.appendedFiles, bytes: result.archiveBytes, truncated: result.truncated },
      "Attachment export completed"
    );
    await notifyAttachmentExportReady({
      ...data,
      archiveBytes: result.archiveBytes,
      expiresAt,
      truncated: result.truncated,
      timeZone: row.timeZone,
    });
  } catch (error) {
    const buildError = error instanceof AttachmentExportBuildError ? error : null;
    const retryable = buildError?.retryable ?? true;
    const errorCode = buildError?.code ?? "build_failed";

    if (retryable && context.attempt < context.maxAttempts) {
      logger.warn(
        { ...logContext, errorCode, err: loggableError(error) },
        "Attachment export failed; will retry"
      );
      throw error;
    }

    logger.error({ ...logContext, errorCode, err: loggableError(error) }, "Attachment export failed");
    await failExport(data, errorCode, storageKey);
  }
};
