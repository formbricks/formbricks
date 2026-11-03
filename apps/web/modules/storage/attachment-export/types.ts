import { z } from "zod";

/** Shared by the routes and the client, so it stays free of server-only imports. */

export const ZAttachmentExportStatus = z.enum(["queued", "running", "completed", "failed", "expired"]);

export type TAttachmentExportStatus = z.infer<typeof ZAttachmentExportStatus>;

/** States the export never leaves; the client stops polling on these. */
export const ATTACHMENT_EXPORT_TERMINAL_STATUSES: ReadonlySet<TAttachmentExportStatus> = new Set([
  "completed",
  "failed",
  "expired",
]);

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
