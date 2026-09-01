import { beforeEach, describe, expect, test, vi } from "vitest";
import { StorageErrorCode } from "@formbricks/storage";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TAttachmentEntry } from "@/modules/storage/lib/collect-response-attachments";
import { getFileStreamForDownload } from "@/modules/storage/service";
import {
  MAX_ATTACHMENT_BYTES,
  buildAttachmentArchiveFileName,
  streamAttachmentsAsZip,
} from "./export-attachments";
import { buildAttachmentManifestCsv } from "./manifest";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/storage/service", () => ({
  getFileStreamForDownload: vi.fn(),
}));

// Mocked so these tests can assert the manifest *rows* the streaming stage produces. Asserting the
// rendered CSV through the archive's bytes would only work while entries are stored uncompressed;
// manifest.test.ts covers the rendering itself.
vi.mock("./manifest", () => ({
  buildAttachmentManifestCsv: vi.fn(() => Promise.resolve("manifest-csv")),
}));

const mockedGetFileStream = vi.mocked(getFileStreamForDownload);
const mockedBuildManifest = vi.mocked(buildAttachmentManifestCsv);

/** The rows handed to the manifest builder — statuses and sizes, independent of ZIP encoding. */
const manifestRows = () => mockedBuildManifest.mock.calls.at(-1)?.[0] ?? [];

const survey = { id: "survey-1", workspaceId: "ws-own" } as unknown as TSurvey;
const NOW = new Date("2026-09-01T12:00:00.000Z");

const okEntry = (overrides: Partial<TAttachmentEntry> = {}): TAttachmentEntry => ({
  zipPath: "2026-09-01_res-1/2_Upload a photo/photo.jpg",
  responseId: "res-1",
  responseCreatedAt: new Date("2026-09-01T10:00:00.000Z"),
  elementId: "el-upload",
  elementLabel: "Upload a photo",
  originalFileName: "photo.jpg",
  status: "ok",
  storage: { storageId: "ws-own", accessType: "private", fileName: "photo.jpg" },
  ...overrides,
});

const streamOf = (content: string) => ({
  ok: true as const,
  data: {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(content));
        controller.close();
      },
    }),
    contentType: "image/jpeg",
    contentLength: content.length,
  },
});

/**
 * Reads the whole archive so entry *names* can be asserted. Names sit uncompressed in each local file
 * header and in the central directory whatever the compression level, so these assertions survive a
 * change from stored to deflated entries. Anything about an entry's contents is asserted through the
 * mocked manifest rows instead.
 */
const readArchive = async (response: Response): Promise<string> =>
  Buffer.from(await response.arrayBuffer()).toString("binary");

describe("buildAttachmentArchiveFileName", () => {
  test("names the archive after the survey and the UTC date", () => {
    expect(buildAttachmentArchiveFileName(survey, NOW)).toBe("survey-1-attachments-2026-09-01.zip");
  });
});

describe("streamAttachmentsAsZip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets the streaming download headers", () => {
    mockedGetFileStream.mockResolvedValue(streamOf("x") as never);

    const response = streamAttachmentsAsZip({ entries: [okEntry()], survey, now: NOW });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="survey-1-attachments-2026-09-01.zip"'
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("writes each attachment at its zip path and appends a manifest", async () => {
    mockedGetFileStream.mockResolvedValue(streamOf("photo-bytes") as never);

    const archive = await readArchive(streamAttachmentsAsZip({ entries: [okEntry()], survey, now: NOW }));

    expect(archive).toContain("2026-09-01_res-1/2_Upload a photo/photo.jpg");
    expect(archive).toContain("manifest.csv");
    // The manifest row carries the response link and the size storage reported.
    expect(manifestRows()).toEqual([
      expect.objectContaining({ responseId: "res-1", status: "ok", bytes: "photo-bytes".length }),
    ]);
  });

  test("asks storage for the decoded file name under the URL's storage id", async () => {
    mockedGetFileStream.mockResolvedValue(streamOf("x") as never);

    await readArchive(
      streamAttachmentsAsZip({
        entries: [
          okEntry({ storage: { storageId: "ws-own", accessType: "private", fileName: "my photo.jpg" } }),
        ],
        survey,
        now: NOW,
      })
    );

    expect(mockedGetFileStream).toHaveBeenCalledWith("my photo.jpg", "ws-own", "private", "ws-own");
  });

  test("records a file storage confirms is gone as missing", async () => {
    // The 200 and its headers are already flushed by the time storage is asked, so a missing object
    // cannot become an error status — it has to surface in the manifest.
    mockedGetFileStream.mockResolvedValue({
      ok: false,
      error: { code: StorageErrorCode.FileNotFoundError },
    } as never);

    const archive = await readArchive(streamAttachmentsAsZip({ entries: [okEntry()], survey, now: NOW }));

    expect(archive).toContain("manifest.csv");
    expect(manifestRows()).toEqual([expect.objectContaining({ status: "missing_in_storage" })]);
  });

  test("does not call an outage a missing file", async () => {
    // Saying "missing" for a credentials or client error would have the manifest assert that intact
    // attachments were lost.
    mockedGetFileStream.mockResolvedValue({
      ok: false,
      error: { code: StorageErrorCode.S3CredentialsError },
    } as never);

    await readArchive(streamAttachmentsAsZip({ entries: [okEntry()], survey, now: NOW }));

    expect(manifestRows()).toEqual([expect.objectContaining({ status: "unavailable_in_storage" })]);
  });

  test("carries the collector's skipped entries into the manifest without asking storage", async () => {
    // Drained rather than inspected: the point is that nothing was fetched and the row still lands.
    await readArchive(
      streamAttachmentsAsZip({
        entries: [okEntry({ status: "skipped_foreign_workspace", zipPath: "", storage: undefined })],
        survey,
        now: NOW,
      })
    );

    expect(mockedGetFileStream).not.toHaveBeenCalled();
    expect(manifestRows()).toEqual([expect.objectContaining({ status: "skipped_foreign_workspace" })]);
  });

  test("truncates before appending an object that would cross the byte ceiling", async () => {
    // Two half-cap objects: the first fits, the second must be refused rather than appended and only
    // then noticed, which would have produced an archive twice the limit.
    const half = Math.floor(MAX_ATTACHMENT_BYTES / 2) + 1;
    mockedGetFileStream.mockResolvedValue({
      ok: true,
      data: { body: streamOf("x").data.body, contentType: "image/jpeg", contentLength: half },
    } as never);

    const archive = await readArchive(
      streamAttachmentsAsZip({
        entries: [
          okEntry(),
          okEntry({ zipPath: "2026-09-01_res-2/2_Upload a photo/photo.jpg", responseId: "res-2" }),
        ],
        survey,
        now: NOW,
      })
    );

    expect(archive).toContain("_TRUNCATED.txt");
    // The first was appended; the second was fetched, refused, and never written.
    expect(archive).toContain("2026-09-01_res-1/");
    expect(archive).not.toContain("2026-09-01_res-2/");
    expect(manifestRows()).toEqual([expect.objectContaining({ responseId: "res-1", status: "ok" })]);
  });

  test("cancels the storage body it refuses, instead of leaving the connection open", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = { cancel } as unknown as ReadableStream<Uint8Array>;
    mockedGetFileStream.mockResolvedValue({
      ok: true,
      data: { body, contentType: "image/jpeg", contentLength: MAX_ATTACHMENT_BYTES + 1 },
    } as never);

    await readArchive(streamAttachmentsAsZip({ entries: [okEntry()], survey, now: NOW }));

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("refuses a single object larger than the whole budget", async () => {
    mockedGetFileStream.mockResolvedValue({
      ok: true,
      data: {
        body: streamOf("x").data.body,
        contentType: "image/jpeg",
        contentLength: MAX_ATTACHMENT_BYTES + 1,
      },
    } as never);

    const archive = await readArchive(streamAttachmentsAsZip({ entries: [okEntry()], survey, now: NOW }));

    expect(archive).toContain("_TRUNCATED.txt");
    expect(archive).not.toContain("2026-09-01_res-1/2_Upload a photo/photo.jpg");
  });

  test("still produces a manifest when there is nothing to write", async () => {
    const archive = await readArchive(streamAttachmentsAsZip({ entries: [], survey, now: NOW }));

    expect(archive).toContain("manifest.csv");
    expect(mockedGetFileStream).not.toHaveBeenCalled();
  });
});
