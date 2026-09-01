import "server-only";
import { type Archiver, type ArchiverError, ZipArchive } from "archiver";
import { Readable } from "node:stream";
import { logger } from "@formbricks/logger";
import { StorageErrorCode } from "@formbricks/storage";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { type TAttachmentEntry } from "@/modules/storage/lib/collect-response-attachments";
import { getFileStreamForDownload } from "@/modules/storage/service";
import { buildAttachmentManifestCsv } from "./manifest";

/**
 * Streams a survey's response attachments as a ZIP (ENG-1256).
 *
 * Synchronous by design: `output: "standalone"` means a long-lived node server, so there is no
 * serverless time cap, and a ZIP stream emits bytes continuously so proxy idle timeouts do not fire
 * either. A background job would need an export-status table, an S3 round trip for the archive, a notify
 * channel and TTL cleanup — and the BullMQ worker is opt-in, so self-hosters running without it would
 * get a menu item that does nothing.
 */

/** Above this the export is refused outright: narrowing the filter is the intended remedy. */
export const MAX_ATTACHMENT_FILES = 5000;

/**
 * The archive stops before crossing this, and says so in `_TRUNCATED.txt`. Enforced mid-stream rather
 * than pre-flighted: object sizes are not in the database, so checking first would mean thousands of S3
 * HEAD requests.
 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 * 1024;

const TRUNCATION_NOTE_PATH = "_TRUNCATED.txt";
const MANIFEST_PATH = "manifest.csv";

export const buildAttachmentArchiveFileName = (survey: TSurvey, now: Date): string =>
  `${survey.id}-attachments-${now.toISOString().slice(0, 10)}.zip`;

/**
 * Holds the storage stream currently being consumed.
 *
 * `archive.abort()` is documented not to drain appended sources, and `Readable.toWeb` cancelling the
 * archive does not reach through it either — so a client that cancels a multi-gigabyte download would
 * leave the in-flight S3 stream open. Whoever tears the archive down destroys this instead.
 */
interface ActiveSource {
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

const streamArchive = async (
  entries: TAttachmentEntry[],
  archive: Archiver,
  activeSource: ActiveSource
): Promise<void> => {
  // Mirrors the collector's report, with a row's status overwritten when storage cannot produce the
  // object and each row's size filled in as storage reports it.
  const manifestRows: TAttachmentEntry[] = [];
  let totalBytes = 0;
  let appendedFiles = 0;
  let truncated = false;

  for (const entry of entries) {
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
      // The response is already committed with a 200, so a storage failure cannot become an error
      // status. Record it in the manifest instead of leaving the file silently absent.
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
      truncated = true;
      break;
    }

    await appendEntry(archive, streamResult.data.body, entry.zipPath, activeSource);

    totalBytes += streamResult.data.contentLength;
    appendedFiles++;
    manifestRows.push({ ...entry, bytes: streamResult.data.contentLength });
  }

  if (truncated) {
    archive.append(buildTruncationNote(appendedFiles), { name: TRUNCATION_NOTE_PATH });
  }

  archive.append(await buildAttachmentManifestCsv(manifestRows), { name: MANIFEST_PATH });

  await archive.finalize();
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
  // level 0: photos and PDFs — what a file-upload element collects — do not compress, so deflating them
  // would burn CPU on the request path for nothing. zip64 because the archive can exceed 4 GB.
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

  // A cancelled download closes the archive without draining what was appended to it, so the storage
  // stream in flight has to be torn down here.
  archive.on("close", destroyActiveSource);
  archive.on("error", destroyActiveSource);

  // Not awaited: the Response must be returned before the archive drains, or no bytes ever flow.
  void streamArchive(entries, archive, activeSource).catch((error: unknown) => {
    logger.error({ error, surveyId: survey.id }, "Attachment export failed mid-stream");
    destroyActiveSource();
    archive.abort();
  });

  return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${buildAttachmentArchiveFileName(survey, now)}"`,
      "Cache-Control": "no-store",
    },
  });
};
