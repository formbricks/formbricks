import "server-only";
import { type Archiver, type ArchiverError, ZipArchive } from "archiver";
import { Readable } from "node:stream";
import { logger } from "@formbricks/logger";
import { StorageErrorCode } from "@formbricks/storage";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { buildAttachmentContentDisposition } from "@/lib/utils/content-disposition";
import { type TAttachmentEntry } from "@/modules/storage/lib/collect-response-attachments";
import { getFileStreamForDownload } from "@/modules/storage/service";
import { MAX_ATTACHMENT_BYTES } from "./constants";
import { buildAttachmentManifestCsv } from "./manifest";

/**
 * Writes a survey's response attachments into a ZIP (ENG-1256, ENG-6862).
 *
 * Two consumers share {@link writeAttachmentArchive}:
 *
 * - The background job (`process-attachment-export-job.ts`) pipes the archive into a multipart upload,
 *   and the browser downloads the finished object through a presigned URL. Storage serves `Range`, so a
 *   dropped connection resumes instead of starting over, and the download never passes through our load
 *   balancer or pods. This is the default path.
 * - {@link streamAttachmentsAsZip} streams the archive as the HTTP response itself. A dropped connection
 *   loses the whole transfer, and a proxy that caps total response time (GCP's backend timeout does)
 *   cuts it. Kept for one release as the fallback while a rolling upgrade still has pods that cannot run
 *   the job; remove it after.
 */

const TRUNCATION_NOTE_PATH = "_TRUNCATED.txt";
const MANIFEST_PATH = "manifest.csv";

export const buildAttachmentArchiveFileName = (survey: TSurvey, now: Date): string =>
  `${survey.id}-attachments-${now.toISOString().slice(0, 10)}.zip`;

/** `Content-Disposition` for an archive, built like every other download's. */
export const buildAttachmentArchiveContentDisposition = (fileName: string): string =>
  buildAttachmentContentDisposition(fileName);

/**
 * Holds the storage stream currently being consumed.
 *
 * `archive.abort()` is documented not to drain appended sources, and `Readable.toWeb` cancelling the
 * archive does not reach through it either — so a client that cancels a multi-gigabyte download would
 * leave the in-flight S3 stream open. Whoever tears the archive down destroys this instead.
 */
export interface ActiveSource {
  stream: Readable | null;
}

/**
 * Appends one entry and resolves when archiver has consumed it.
 *
 * Sequential on purpose: `archive.append` queues internally, so appending every entry up front would
 * open one S3 stream per file — thousands of them — and hold them all open while the archive drains.
 */
const appendEntry = (
  archive: Archiver,
  body: ReadableStream<Uint8Array>,
  zipPath: string,
  activeSource: ActiveSource
): Promise<void> =>
  new Promise((resolve, reject) => {
    const source = Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
    activeSource.stream = source;

    const cleanup = () => {
      archive.off("entry", onEntry);
      archive.off("error", onError);
      activeSource.stream = null;
    };
    const onEntry = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      source.destroy();
      reject(error);
    };

    archive.on("entry", onEntry);
    archive.on("error", onError);
    archive.append(source, { name: zipPath });
  });

/** Discards a storage body the archive will not read, so the S3 connection is not left open. */
const discardBody = (body: ReadableStream<Uint8Array>): void => {
  void body.cancel().catch((error: unknown) => {
    logger.warn({ error }, "Attachment export: failed to cancel an unused storage stream");
  });
};

/**
 * `missing_in_storage` is reserved for an object storage confirms is gone. Every other failure —
 * credentials, a client error, a rejected name — means the object's fate is unknown, and saying
 * "missing" during an outage would have the manifest assert that intact attachments were lost.
 */
const statusForStorageError = (code: StorageErrorCode): TAttachmentEntry["status"] =>
  code === StorageErrorCode.FileNotFoundError ? "missing_in_storage" : "unavailable_in_storage";

const buildTruncationNote = (fileCount: number): string =>
  `This archive was truncated after ${fileCount} files because the export reached the ${MAX_ATTACHMENT_BYTES} byte limit.\nNarrow the response filter and download again to get the rest.\n`;

export interface AttachmentArchiveSummary {
  /** Attachments written into the archive. */
  appendedFiles: number;
  /** Their combined size, as storage reported it. Not the archive's size: see `archive.pointer()`. */
  attachmentBytes: number;
  /** The byte ceiling stopped the archive early; `_TRUNCATED.txt` and the manifest say so. */
  truncated: boolean;
}

/**
 * Appends every entry, the truncation note and the manifest, then finalizes the archive. Resolves once
 * the last byte is queued; the consumer of the archive stream decides when it is actually delivered.
 */
export const writeAttachmentArchive = async (
  entries: TAttachmentEntry[],
  archive: Archiver,
  activeSource: ActiveSource
): Promise<AttachmentArchiveSummary> => {
  // Mirrors the collector's report, with a row's status overwritten when storage cannot produce the
  // object and each row's size filled in as storage reports it. It stays a full mirror even after a
  // truncation: a row saying a file was dropped is the only thing in the archive that names it, and
  // `_TRUNCATED.txt` carries a count alone.
  const manifestRows: TAttachmentEntry[] = [];
  let totalBytes = 0;
  let appendedFiles = 0;
  let truncatedFrom: number | null = null;

  for (const [index, entry] of entries.entries()) {
    if (entry.status !== "ok" || !entry.storage) {
      manifestRows.push(entry);
      continue;
    }

    const streamResult = await getFileStreamForDownload(
      entry.storage.fileName,
      entry.storage.storageId,
      entry.storage.accessType,
      entry.storage.storageId
    );

    if (!streamResult.ok) {
      // One unreadable object must not sink the whole archive (and once a streamed response has sent
      // its 200 it could not become an error status anyway). Record it in the manifest instead of
      // leaving the file silently absent.
      const status = statusForStorageError(streamResult.error.code);
      logger.warn(
        { zipPath: entry.zipPath, error: streamResult.error },
        "Attachment export: storage could not produce a file"
      );
      manifestRows.push({ ...entry, status });
      continue;
    }

    // Checked before appending, not after: appending first would let one oversized object blow past the
    // limit entirely, and two large ones produce an archive twice the cap.
    if (totalBytes + streamResult.data.contentLength > MAX_ATTACHMENT_BYTES) {
      discardBody(streamResult.data.body);
      truncatedFrom = index;
      break;
    }

    await appendEntry(archive, streamResult.data.body, entry.zipPath, activeSource);

    totalBytes += streamResult.data.contentLength;
    appendedFiles++;
    manifestRows.push({ ...entry, bytes: streamResult.data.contentLength });
  }

  if (truncatedFrom !== null) {
    // Everything from the refused entry onwards, so the manifest still lists what is missing. A row the
    // collector already rejected keeps its own reason: it was never a candidate for the byte ceiling, and
    // relabelling it would name the wrong cause.
    for (const dropped of entries.slice(truncatedFrom)) {
      manifestRows.push(
        dropped.status === "ok" ? { ...dropped, status: "skipped_export_truncated" } : dropped
      );
    }
    archive.append(buildTruncationNote(appendedFiles), { name: TRUNCATION_NOTE_PATH });
  }

  archive.append(await buildAttachmentManifestCsv(manifestRows), { name: MANIFEST_PATH });

  await archive.finalize();

  return { appendedFiles, attachmentBytes: totalBytes, truncated: truncatedFrom !== null };
};

export interface AttachmentArchive {
  archive: Archiver;
  activeSource: ActiveSource;
  /** Tears down the storage stream being read, which closing the archive does not reach. */
  destroyActiveSource: () => void;
}

/** A ZIP archive configured for attachments, with its in-flight storage stream wired for teardown. */
export const createAttachmentArchive = (): AttachmentArchive => {
  // level 0: photos and PDFs — what a file-upload element collects — do not compress, so deflating them
  // would burn CPU for nothing. zip64 because the archive can exceed 4 GB.
  // archiver 8 dropped the `archiver("zip", …)` factory in favour of the format classes.
  const archive = new ZipArchive({ zlib: { level: 0 }, forceZip64: true });
  const activeSource: ActiveSource = { stream: null };

  const destroyActiveSource = () => {
    const source = activeSource.stream;
    activeSource.stream = null;
    source?.destroy();
  };

  archive.on("warning", (warning: ArchiverError) => {
    logger.warn({ warning }, "Attachment export: archiver warning");
  });

  // A cancelled consumer closes the archive without draining what was appended to it, so the storage
  // stream in flight has to be torn down here.
  archive.on("close", destroyActiveSource);
  archive.on("error", destroyActiveSource);

  return { archive, activeSource, destroyActiveSource };
};

export const streamAttachmentsAsZip = ({
  entries,
  survey,
  now,
}: {
  entries: TAttachmentEntry[];
  survey: TSurvey;
  now: Date;
}): Response => {
  const { archive, activeSource, destroyActiveSource } = createAttachmentArchive();

  // Not awaited: the Response must be returned before the archive drains, or no bytes ever flow.
  void writeAttachmentArchive(entries, archive, activeSource).catch((error: unknown) => {
    logger.error({ error, surveyId: survey.id }, "Attachment export failed mid-stream");
    destroyActiveSource();
    archive.abort();
  });

  return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": buildAttachmentArchiveContentDisposition(
        buildAttachmentArchiveFileName(survey, now)
      ),
      "Cache-Control": "no-store",
    },
  });
};
