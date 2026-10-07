import "server-only";
import { convertToCsv } from "@/lib/utils/file-conversion";
import type { TAttachmentEntry } from "@/modules/storage/lib/collect-response-attachments";

/**
 * The `manifest.csv` at the root of an attachment archive.
 *
 * Without it the archive is a pile of folders: this is what lets a reporting workflow join the files
 * back to the CSV/Excel response export (on `responseId`) and see which attachments did not make it.
 *
 * Timestamps are ISO 8601 UTC, not localised — the manifest is machine-facing.
 *
 * Goes through `convertToCsv` rather than hand-rolled joining because every column here carries
 * respondent-supplied text (file names, question headlines), and that helper already defangs spreadsheet
 * formula injection.
 */

export const MANIFEST_FIELDS = [
  "filePath",
  "responseId",
  "responseCreatedAt",
  "elementId",
  "elementLabel",
  "originalFileName",
  "bytes",
  "status",
] as const;

export const buildAttachmentManifestCsv = async (entries: TAttachmentEntry[]): Promise<string> =>
  convertToCsv(
    [...MANIFEST_FIELDS],
    entries.map((entry) => ({
      filePath: entry.zipPath,
      responseId: entry.responseId,
      responseCreatedAt: entry.responseCreatedAt.toISOString(),
      elementId: entry.elementId,
      elementLabel: entry.elementLabel,
      originalFileName: entry.originalFileName,
      bytes: entry.bytes ?? "",
      status: entry.status,
    }))
  );
