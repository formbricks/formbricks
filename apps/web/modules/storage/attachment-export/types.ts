import { z } from "zod";

/** Shared by the routes and the client, so it stays free of server-only imports. */

export const ZAttachmentExportStatus = z.enum(["queued", "running", "completed", "failed", "expired"]);

export type TAttachmentExportStatus = z.infer<typeof ZAttachmentExportStatus>;

/** The statuses of an export still being built: at most one per requester and survey. */
export const ATTACHMENT_EXPORT_ACTIVE_STATUSES = [
  "queued",
  "running",
] as const satisfies readonly TAttachmentExportStatus[];

/**
 * Why an export failed, stored in `errorCode`. Ids only, never a message:
 * - `survey_not_found`, `invalid_filter`, `too_many_files`, `no_attachments`: no retry can fix them.
 * - `build_timeout`, `storage_upload_failed`, `build_failed`: the last attempt failed.
 * - `stale`: the reconcile job gave up on a lost build. `enqueue_failed`: the job never reached the queue.
 */
export const ZAttachmentExportErrorCode = z.enum([
  "survey_not_found",
  "invalid_filter",
  "too_many_files",
  "no_attachments",
  "build_timeout",
  "storage_upload_failed",
  "build_failed",
  "stale",
  "enqueue_failed",
]);

export type TAttachmentExportErrorCode = z.infer<typeof ZAttachmentExportErrorCode>;

/** What the routes return for one export. Dates are ISO strings; sizes are bytes. */
export const ZAttachmentExport = z.object({
  id: z.string(),
  surveyId: z.string(),
  status: ZAttachmentExportStatus,
  /** True when a response filter narrowed the export. */
  filtered: z.boolean(),
  /** The pre-flight's counts, known from the start. */
  fileCount: z.number().int(),
  responseCount: z.number().int(),
  /** Set once built: what the archive holds, and the archive's own size. */
  includedFileCount: z.number().int().nullable(),
  totalBytes: z.number().nullable(),
  truncated: z.boolean(),
  /** A short code when `status` is `failed`. */
  errorCode: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});

export type TAttachmentExport = z.infer<typeof ZAttachmentExport>;
