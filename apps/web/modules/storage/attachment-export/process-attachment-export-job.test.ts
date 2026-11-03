import { prisma } from "@/lib/__mocks__/database";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deleteFile, uploadFileStream } from "@formbricks/storage";
import { getSurvey } from "@/lib/survey/service";
import { collectResponseAttachments } from "@/modules/storage/lib/collect-response-attachments";
import { ATTACHMENT_EXPORT_MAX_BUILD_MS, MAX_ATTACHMENT_FILES } from "./constants";
import { writeAttachmentArchive } from "./export-attachments";
import { notifyAttachmentExportFailed, notifyAttachmentExportReady } from "./notify-requester";
import { processAttachmentExportJob } from "./process-attachment-export-job";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@formbricks/storage", () => ({
  uploadFileStream: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock("@formbricks/jobs", () => ({
  enqueueAttachmentExportJob: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));

vi.mock("./notify-requester", () => ({
  notifyAttachmentExportReady: vi.fn(),
  notifyAttachmentExportFailed: vi.fn(),
}));

vi.mock("@/modules/storage/lib/collect-response-attachments", () => ({
  collectResponseAttachments: vi.fn(),
}));

const archiveStub = vi.hoisted(() => ({
  pointer: vi.fn(() => 4096),
  abort: vi.fn(),
  destroyActiveSource: vi.fn(),
}));

vi.mock("./export-attachments", () => ({
  buildAttachmentArchiveFileName: vi.fn(() => "survey-1-attachments-2026-11-03.zip"),
  createAttachmentArchive: vi.fn(() => ({
    archive: {
      pointer: archiveStub.pointer,
      abort: archiveStub.abort,
      pipe: <T>(destination: T) => destination,
    },
    activeSource: { stream: null },
    destroyActiveSource: archiveStub.destroyActiveSource,
  })),
  writeAttachmentArchive: vi.fn(),
}));

const mockedUpload = vi.mocked(uploadFileStream);
const mockedDeleteFile = vi.mocked(deleteFile);
const mockedGetSurvey = vi.mocked(getSurvey);
const mockedCollect = vi.mocked(collectResponseAttachments);
const mockedWrite = vi.mocked(writeAttachmentArchive);
const mockedNotifyReady = vi.mocked(notifyAttachmentExportReady);
const mockedNotifyFailed = vi.mocked(notifyAttachmentExportFailed);

const EXPORT_ID = "cm8cmpnjj000108jfdr9exp01";
const WORKSPACE_ID = "cm8cmpnjj000108jfdr9wks01";
const SURVEY_ID = "cm8cmpnjj000108jfdr9srv01";
const STORAGE_KEY = `${WORKSPACE_ID}/private/surveys/${SURVEY_ID}/exports/${EXPORT_ID}.zip`;
const NOW = new Date("2026-11-03T12:00:00.000Z");

const data = { attachmentExportId: EXPORT_ID, workspaceId: WORKSPACE_ID, dispatchCount: 0 };
const context = {
  attempt: 1,
  maxAttempts: 2,
  jobId: `${EXPORT_ID}-0`,
  jobName: "attachment-export.process",
  queueName: "attachment-export",
};
const finalContext = { ...context, attempt: 2 };

const filter = { finished: true };

const queuedRow = (overrides: Record<string, unknown> = {}) => ({
  surveyId: SURVEY_ID,
  status: "queued",
  filterCriteria: filter,
  timeZone: "Asia/Riyadh",
  createdAt: NOW,
  ...overrides,
});

const updateCalls = () => prisma.attachmentExport.updateMany.mock.calls.map(([args]) => args);

describe("processAttachmentExportJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    prisma.attachmentExport.findFirst.mockResolvedValue(queuedRow() as never);
    prisma.attachmentExport.updateMany.mockResolvedValue({ count: 1 });
    mockedGetSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: WORKSPACE_ID } as never);
    mockedCollect.mockResolvedValue({
      entries: [],
      fileCount: 3,
      responseCount: 2,
      exceedsMaxFiles: false,
    });
    mockedWrite.mockResolvedValue({ appendedFiles: 3, attachmentBytes: 4000, truncated: false });
    mockedUpload.mockResolvedValue({ ok: true, data: undefined });
    mockedDeleteFile.mockResolvedValue({ ok: true, data: undefined });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("builds the archive into storage and records what it holds", async () => {
    await processAttachmentExportJob(data, context);

    // Claimed with the storage key recorded up front, so a killed build still leaves a key to clean up.
    // Only by the export's current dispatch, so a job a re-dispatch superseded cannot claim it.
    expect(updateCalls()[0]).toEqual({
      where: {
        id: EXPORT_ID,
        workspaceId: WORKSPACE_ID,
        status: { in: ["queued", "running"] },
        dispatchCount: 0,
      },
      data: { status: "running", startedAt: NOW, storageKey: STORAGE_KEY, errorCode: null },
    });
    // Re-collected with the filter and zone stored at request time, under the same file cap.
    expect(mockedCollect).toHaveBeenCalledWith({
      survey: { id: SURVEY_ID, workspaceId: WORKSPACE_ID },
      filterCriteria: filter,
      maxFiles: MAX_ATTACHMENT_FILES,
      timeZone: "Asia/Riyadh",
    });
    // A Node Readable, not archiver's own stream: the SDK's upload rejects anything else at runtime.
    expect(mockedUpload.mock.calls[0][1]).toBeInstanceOf(Readable);
    expect(mockedUpload).toHaveBeenCalledWith(STORAGE_KEY, expect.anything(), {
      contentType: "application/zip",
      contentDisposition: 'attachment; filename="survey-1-attachments-2026-11-03.zip"',
      signal: expect.any(AbortSignal),
    });
    expect(updateCalls()[1]).toEqual({
      where: { id: EXPORT_ID, workspaceId: WORKSPACE_ID, status: "running" },
      data: {
        status: "completed",
        includedFileCount: 3,
        totalBytes: BigInt(4096),
        truncated: false,
        finishedAt: NOW,
        // Three calendar months after the build finished: the same day in February.
        expiresAt: new Date("2027-02-03T12:00:00.000Z"),
      },
    });
    expect(mockedDeleteFile).not.toHaveBeenCalled();
    // The requester gets the link once the row says completed, with the date it stops working.
    expect(mockedNotifyReady).toHaveBeenCalledWith({
      attachmentExportId: EXPORT_ID,
      workspaceId: WORKSPACE_ID,
      archiveBytes: 4096,
      expiresAt: new Date("2027-02-03T12:00:00.000Z"),
      truncated: false,
      timeZone: "Asia/Riyadh",
    });
    expect(mockedNotifyFailed).not.toHaveBeenCalled();
  });

  test("exports every response when no filter was stored", async () => {
    prisma.attachmentExport.findFirst.mockResolvedValue(queuedRow({ filterCriteria: null }) as never);

    await processAttachmentExportJob(data, context);

    expect(mockedCollect).toHaveBeenCalledWith(expect.objectContaining({ filterCriteria: undefined }));
  });

  test("looks the export up inside the job's workspace only", async () => {
    await processAttachmentExportJob(data, context);

    expect(prisma.attachmentExport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: EXPORT_ID, workspaceId: WORKSPACE_ID } })
    );
  });

  test.each(["completed", "failed", "expired"])("skips an export that is already %s", async (status) => {
    prisma.attachmentExport.findFirst.mockResolvedValue(queuedRow({ status }) as never);

    await processAttachmentExportJob(data, context);

    expect(prisma.attachmentExport.updateMany).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  test("resumes an export a previous attempt left running", async () => {
    prisma.attachmentExport.findFirst.mockResolvedValue(queuedRow({ status: "running" }) as never);

    await processAttachmentExportJob(data, finalContext);

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    expect(updateCalls()[1].data).toEqual(expect.objectContaining({ status: "completed" }));
  });

  test("fails at once, without retrying, when the survey is in another workspace", async () => {
    mockedGetSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: "cm8cmpnjj000108jfdr9oth01" } as never);

    await expect(processAttachmentExportJob(data, context)).resolves.toBeUndefined();

    expect(mockedCollect).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(updateCalls()[1]).toEqual({
      where: { id: EXPORT_ID, workspaceId: WORKSPACE_ID, status: { in: ["queued", "running"] } },
      data: { status: "failed", errorCode: "survey_not_found", finishedAt: NOW },
    });
  });

  test("fails without retrying when the survey grew past the file cap while queued", async () => {
    mockedCollect.mockResolvedValue({
      entries: [],
      fileCount: 5001,
      responseCount: 9,
      exceedsMaxFiles: true,
    });

    await processAttachmentExportJob(data, context);

    expect(mockedUpload).not.toHaveBeenCalled();
    expect(updateCalls()[1].data).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "too_many_files" })
    );
  });

  test("fails without retrying when the stored filter no longer parses", async () => {
    prisma.attachmentExport.findFirst.mockResolvedValue(
      queuedRow({ filterCriteria: { finished: "yes" } }) as never
    );

    await processAttachmentExportJob(data, context);

    expect(mockedCollect).not.toHaveBeenCalled();
    expect(updateCalls()[1].data).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "invalid_filter" })
    );
  });

  test("rethrows a failed upload on a non-final attempt, leaving the export running for the retry", async () => {
    mockedUpload.mockResolvedValue({ ok: false, error: { code: "unknown" } } as never);

    await expect(processAttachmentExportJob(data, context)).rejects.toThrow("storage_upload_failed");

    // Only the claim: no terminal write that would make the retry skip the export.
    expect(updateCalls()).toHaveLength(1);
    expect(archiveStub.abort).toHaveBeenCalled();
    // The retry may still succeed, so nobody is told it failed yet.
    expect(mockedNotifyFailed).not.toHaveBeenCalled();
  });

  test("fails the export on the final attempt and deletes anything written", async () => {
    mockedUpload.mockResolvedValue({ ok: false, error: { code: "unknown" } } as never);

    await expect(processAttachmentExportJob(data, finalContext)).resolves.toBeUndefined();

    expect(updateCalls()[1].data).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "storage_upload_failed" })
    );
    expect(mockedDeleteFile).toHaveBeenCalledWith(STORAGE_KEY);
    expect(mockedNotifyFailed).toHaveBeenCalledWith({
      attachmentExportId: EXPORT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(mockedNotifyReady).not.toHaveBeenCalled();
    // The key is cleared once the delete went through, so the reconcile job does not retry it.
    expect(updateCalls()[2]).toEqual({
      where: { id: EXPORT_ID, workspaceId: WORKSPACE_ID, status: "failed" },
      data: { storageKey: null },
    });
  });

  test("aborts a build that runs past the wall-time cap", async () => {
    // The writer never finishes; the upload ends only when the job's signal aborts it.
    mockedWrite.mockReturnValue(new Promise(() => undefined));
    mockedUpload.mockImplementation(
      (_key, _body, { signal }) =>
        new Promise((resolve) =>
          signal?.addEventListener("abort", () => resolve({ ok: false, error: { code: "unknown" } } as never))
        )
    );

    const run = processAttachmentExportJob(data, finalContext);
    await vi.advanceTimersByTimeAsync(ATTACHMENT_EXPORT_MAX_BUILD_MS);
    await run;

    expect(updateCalls()[1].data).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "build_timeout" })
    );
  });

  test("deletes the archive when the export was settled while it built", async () => {
    prisma.attachmentExport.updateMany
      .mockResolvedValueOnce({ count: 1 }) // claim
      .mockResolvedValueOnce({ count: 0 }); // complete: failed as stale meanwhile

    await processAttachmentExportJob(data, context);

    expect(mockedDeleteFile).toHaveBeenCalledWith(STORAGE_KEY);
    expect(mockedNotifyReady).not.toHaveBeenCalled();
  });

  test("keeps the archive when another build completed the export", async () => {
    prisma.attachmentExport.updateMany
      .mockResolvedValueOnce({ count: 1 }) // claim
      .mockResolvedValueOnce({ count: 0 }); // complete: the other build got there first
    prisma.attachmentExport.findFirst
      .mockResolvedValueOnce(queuedRow() as never)
      .mockResolvedValueOnce({ status: "completed" } as never);

    await processAttachmentExportJob(data, context);

    expect(mockedDeleteFile).not.toHaveBeenCalled();
    expect(mockedNotifyReady).not.toHaveBeenCalled();
  });

  test("does not email a failure when the export was already settled elsewhere", async () => {
    mockedUpload.mockResolvedValue({ ok: false, error: { code: "unknown" } } as never);
    prisma.attachmentExport.updateMany
      .mockResolvedValueOnce({ count: 1 }) // claim
      .mockResolvedValueOnce({ count: 0 }); // fail: already failed as stale

    await processAttachmentExportJob(data, finalContext);

    expect(mockedNotifyFailed).not.toHaveBeenCalled();
  });

  test("does nothing when another delivery settled the export before the claim", async () => {
    prisma.attachmentExport.updateMany.mockResolvedValueOnce({ count: 0 });

    await processAttachmentExportJob(data, context);

    expect(mockedGetSurvey).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});
