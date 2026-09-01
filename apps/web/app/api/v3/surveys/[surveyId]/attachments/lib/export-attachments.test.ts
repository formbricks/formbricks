import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TAttachmentEntry } from "@/modules/storage/lib/collect-response-attachments";
import { getFileStreamForDownload } from "@/modules/storage/service";
import {
  MAX_ATTACHMENT_BYTES,
  buildAttachmentArchiveFileName,
  streamAttachmentsAsZip,
} from "./export-attachments";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/storage/service", () => ({
  getFileStreamForDownload: vi.fn(),
}));

const mockedGetFileStream = vi.mocked(getFileStreamForDownload);

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
 * Reads the whole archive. Entries are stored (level 0), so file names and text contents appear
 * verbatim in the bytes — which is what lets these tests assert on the manifest without unzipping.
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
    // The manifest joins each file back to its response and records the size storage reported.
    expect(archive).toContain('"res-1"');
    expect(archive).toContain('"2026-09-01T10:00:00.000Z"');
    expect(archive).toContain('"ok"');
    expect(archive).toContain(String("photo-bytes".length));
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

  test("records a file that vanished from storage instead of failing the download", async () => {
    // The 200 and its headers are already flushed by the time storage is asked, so a missing object
    // cannot become an error status — it has to surface in the manifest.
    mockedGetFileStream.mockResolvedValue({ ok: false, error: { code: "file_not_found" } } as never);

    const archive = await readArchive(streamAttachmentsAsZip({ entries: [okEntry()], survey, now: NOW }));

    expect(archive).toContain('"missing_in_storage"');
    expect(archive).toContain("manifest.csv");
  });

  test("carries the collector's skipped entries into the manifest without asking storage", async () => {
    const archive = await readArchive(
      streamAttachmentsAsZip({
        entries: [okEntry({ status: "skipped_foreign_workspace", zipPath: "", storage: undefined })],
        survey,
        now: NOW,
      })
    );

    expect(mockedGetFileStream).not.toHaveBeenCalled();
    expect(archive).toContain('"skipped_foreign_workspace"');
  });

  test("truncates once the byte ceiling is crossed and says so in the archive", async () => {
    // The ceiling is enforced from what storage reports, not from bytes actually read, so one oversized
    // entry is enough to exercise it.
    mockedGetFileStream
      .mockResolvedValueOnce({
        ok: true,
        data: {
          body: streamOf("x").data.body,
          contentType: "image/jpeg",
          contentLength: MAX_ATTACHMENT_BYTES,
        },
      } as never)
      .mockResolvedValue(streamOf("second") as never);

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
    expect(archive).toContain("truncated after 1 files");
    // The second entry was never fetched, so it is absent from the archive.
    expect(mockedGetFileStream).toHaveBeenCalledTimes(1);
    expect(archive).not.toContain("2026-09-01_res-2/");
  });

  test("still produces a manifest when there is nothing to write", async () => {
    const archive = await readArchive(streamAttachmentsAsZip({ entries: [], survey, now: NOW }));

    expect(archive).toContain("manifest.csv");
    expect(mockedGetFileStream).not.toHaveBeenCalled();
  });
});
