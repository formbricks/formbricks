import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enqueueAttachmentExportJob } from "@formbricks/jobs";
import { deleteFile } from "@formbricks/storage";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import { isNewReleaseWorkEnabled } from "@/lib/upgrade/compatibility";
import { ATTACHMENT_EXPORT_REDISPATCH_AFTER_MS, ATTACHMENT_EXPORT_STALE_AFTER_MS } from "./constants";
import { processAttachmentExportReconcileJob } from "./process-attachment-export-reconcile-job";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@formbricks/jobs", () => ({ enqueueAttachmentExportJob: vi.fn() }));
vi.mock("@formbricks/storage", () => ({ deleteFile: vi.fn() }));
vi.mock("@/lib/jobs/config", () => ({ getJobsQueueingConfig: vi.fn() }));
vi.mock("@/lib/upgrade/compatibility", () => ({ isNewReleaseWorkEnabled: vi.fn() }));

const mockedEnqueue = vi.mocked(enqueueAttachmentExportJob);
const mockedDeleteFile = vi.mocked(deleteFile);
const mockedQueueingConfig = vi.mocked(getJobsQueueingConfig);
const mockedReleaseWork = vi.mocked(isNewReleaseWorkEnabled);

const NOW = new Date("2026-11-03T12:00:00.000Z");
const context = {
  attempt: 1,
  maxAttempts: 3,
  jobId: "reconcile-1",
  jobName: "attachment-export.reconcile",
  queueName: "background-jobs",
};
const run = () => processAttachmentExportReconcileJob({ scope: "global" }, context);

/** `findMany` is called for lost dispatches, expiring archives, then failed leftovers, in that order. */
const mockFindMany = ({
  lost = [],
  expiring = [],
  failed = [],
}: {
  lost?: unknown[];
  expiring?: unknown[];
  failed?: unknown[];
}) => {
  prisma.attachmentExport.findMany
    .mockResolvedValueOnce(lost as never)
    .mockResolvedValueOnce(expiring as never)
    .mockResolvedValueOnce(failed as never);
};

describe("processAttachmentExportReconcileJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    prisma.attachmentExport.updateMany.mockResolvedValue({ count: 0 });
    mockedQueueingConfig.mockReturnValue({ enabled: true, redisUrl: "redis://localhost:6379" });
    mockedReleaseWork.mockResolvedValue(true);
    mockedDeleteFile.mockResolvedValue({ ok: true, data: undefined });
    mockedEnqueue.mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("fails queued and running exports created before the stale cutoff", async () => {
    mockFindMany({});

    await run();

    expect(prisma.attachmentExport.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["queued", "running"] },
        createdAt: { lt: new Date(NOW.getTime() - ATTACHMENT_EXPORT_STALE_AFTER_MS) },
      },
      data: { status: "failed", errorCode: "stale", finishedAt: NOW },
    });
  });

  test("re-dispatches a lost queued export under a new job id", async () => {
    const lost = { id: "exp-1", workspaceId: "ws-1", dispatchCount: 0 };
    mockFindMany({ lost: [lost] });
    prisma.attachmentExport.updateMany
      .mockResolvedValueOnce({ count: 0 }) // stale
      .mockResolvedValueOnce({ count: 1 }); // dispatch bump

    await run();

    expect(prisma.attachmentExport.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: {
          status: "queued",
          updatedAt: { lt: new Date(NOW.getTime() - ATTACHMENT_EXPORT_REDISPATCH_AFTER_MS) },
        },
      })
    );
    // Compare-and-set on the count, so overlapping ticks enqueue once.
    expect(prisma.attachmentExport.updateMany).toHaveBeenCalledWith({
      where: { id: "exp-1", status: "queued", dispatchCount: 0 },
      data: { dispatchCount: { increment: 1 } },
    });
    // The new job carries the bumped count, so the job it supersedes skips the export if it ever runs.
    expect(mockedEnqueue).toHaveBeenCalledWith(
      { attachmentExportId: "exp-1", workspaceId: "ws-1", dispatchCount: 1 },
      { jobId: "exp-1-1" }
    );
  });

  test("does not enqueue when another tick already bumped the dispatch", async () => {
    mockFindMany({ lost: [{ id: "exp-1", workspaceId: "ws-1", dispatchCount: 0 }] });

    await run();

    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  test.each([
    ["queueing is disabled", () => mockedQueueingConfig.mockReturnValue({ enabled: false, redisUrl: null })],
    ["the online upgrade has not activated", () => mockedReleaseWork.mockResolvedValue(false)],
  ])("does not re-dispatch while %s", async (_label, arrange) => {
    arrange();
    // The lost-dispatch query is skipped, so the first findMany is the expiring one.
    prisma.attachmentExport.findMany.mockResolvedValue([] as never);

    await run();

    expect(mockedEnqueue).not.toHaveBeenCalled();
    expect(prisma.attachmentExport.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "queued" }) })
    );
  });

  test("deletes expired archives and marks only the deleted ones expired", async () => {
    mockFindMany({
      expiring: [
        { id: "exp-ok", storageKey: "ws/private/surveys/s/exports/exp-ok.zip" },
        { id: "exp-err", storageKey: "ws/private/surveys/s/exports/exp-err.zip" },
      ],
    });
    mockedDeleteFile
      .mockResolvedValueOnce({ ok: true, data: undefined })
      .mockResolvedValueOnce({ ok: false, error: { code: "unknown" } } as never);

    await run();

    expect(prisma.attachmentExport.findMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({ where: { status: "completed", expiresAt: { lt: NOW } } })
    );
    expect(mockedDeleteFile).toHaveBeenCalledWith("ws/private/surveys/s/exports/exp-ok.zip");
    // The failed delete keeps its row `completed`, so the next pass tries again.
    expect(prisma.attachmentExport.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["exp-ok"] }, status: "completed" },
      data: { status: "expired", storageKey: null },
    });
  });

  test("retries the archive delete of failed exports", async () => {
    mockFindMany({ failed: [{ id: "exp-f", storageKey: "ws/private/surveys/s/exports/exp-f.zip" }] });

    await run();

    expect(mockedDeleteFile).toHaveBeenCalledWith("ws/private/surveys/s/exports/exp-f.zip");
    expect(prisma.attachmentExport.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["exp-f"] }, status: "failed" },
      data: { storageKey: null },
    });
  });
});
