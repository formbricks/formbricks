import "server-only";
import { type Archiver, type ArchiverError, ZipArchive } from "archiver";
import { Readable } from "node:stream";
import { logger } from "@formbricks/logger";
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
 * Above this the archive is finalised early with a `_TRUNCATED.txt` note. Enforced mid-stream rather
 * than pre-flighted: object sizes are not in the database, so checking first would mean thousands of S3
 * HEAD requests.
 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 * 1024;

const TRUNCATION_NOTE_PATH = "_TRUNCATED.txt";
const MANIFEST_PATH = "manifest.csv";

export const buildAttachmentArchiveFileName = (survey: TSurvey, now: Date): string =>
  `${survey.id}-attachments-${now.toISOString().slice(0, 10)}.zip`;

/**
 * Appends one entry and resolves when archiver has consumed it.
 *
 * Sequential on purpose: `archive.append` queues internally, so appending every entry up front would
 * open one S3 stream per file — thousands of them — and hold them all open while the archive drains.
 */
const appendEntry = (archive: Archiver, body: ReadableStream<Uint8Array>, zipPath: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      archive.off("entry", onEntry);
      archive.off("error", onError);
    };
    const onEntry = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    archive.on("entry", onEntry);
    archive.on("error", onError);
    archive.append(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), { name: zipPath });
  });

const streamArchive = async (entries: TAttachmentEntry[], archive: Archiver): Promise<void> => {
  // Mirrors the collector's report, with a row's status overwritten when the object turns out to be
  // gone and each row's size filled in as storage reports it.
  const manifestRows: TAttachmentEntry[] = [];
  let totalBytes = 0;
  let truncatedAfter: number | null = null;

  for (const entry of entries) {
    if (entry.status !== "ok" || !entry.storage) {
      manifestRows.push(entry);
      continue;
    }

    if (totalBytes >= MAX_ATTACHMENT_BYTES) {
      truncatedAfter = manifestRows.filter((row) => row.status === "ok").length;
      break;
    }

    const streamResult = await getFileStreamForDownload(
      entry.storage.fileName,
      entry.storage.storageId,
      entry.storage.accessType,
      entry.storage.storageId
    );

    if (!streamResult.ok) {
      // The response is already committed with a 200, so a missing object cannot become an error
      // status. Record it in the manifest instead of leaving the file silently absent.
      logger.warn(
        { zipPath: entry.zipPath, error: streamResult.error },
        "Attachment export: file missing from storage"
      );
      manifestRows.push({ ...entry, status: "missing_in_storage" });
      continue;
    }

    await appendEntry(archive, streamResult.data.body, entry.zipPath);

    totalBytes += streamResult.data.contentLength;
    manifestRows.push({ ...entry, bytes: streamResult.data.contentLength });
  }

  if (truncatedAfter !== null) {
    archive.append(
      `This archive was truncated after ${truncatedAfter} files because the export exceeded ${MAX_ATTACHMENT_BYTES} bytes.\nNarrow the response filter and download again to get the rest.\n`,
      { name: TRUNCATION_NOTE_PATH }
    );
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

  archive.on("warning", (warning: ArchiverError) => {
    logger.warn({ warning }, "Attachment export: archiver warning");
  });

  // Not awaited: the Response must be returned before the archive drains, or no bytes ever flow.
  void streamArchive(entries, archive).catch((error) => {
    logger.error({ error, surveyId: survey.id }, "Attachment export failed mid-stream");
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
