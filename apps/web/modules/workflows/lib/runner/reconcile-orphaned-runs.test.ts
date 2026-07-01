import { beforeEach, describe, expect, test, vi } from "vitest";
import { reconcileOrphanedWorkflowRuns } from "./reconcile-orphaned-runs";

const { findMany, updateMany } = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn() }));
const { warn, error, info, debug } = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: { workflowRun: { findMany, updateMany } },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn, error, info, debug } }));

const NOW = new Date("2026-07-01T12:00:00.000Z");
// Grace window is 2 min, ceiling is 24 h (see reconcile-constants).
const orphaned = new Date(NOW.getTime() - 10 * 60 * 1000); // 10 min old → eligible orphan
const ancient = new Date(NOW.getTime() - 25 * 60 * 60 * 1000); // 25 h old → past the ceiling

const dispatch =
  vi.fn<(input: { workflowRunId: string; workflowId: string; workspaceId: string }) => Promise<void>>();

const runRow = (id: string, createdAt: Date) => ({
  id,
  workflowId: `wf_${id}`,
  workspaceId: `ws_${id}`,
  createdAt,
});

const reconcile = () => reconcileOrphanedWorkflowRuns({ dispatch, now: NOW });

beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockResolvedValue(undefined);
  updateMany.mockResolvedValue({ count: 1 });
});

describe("reconcileOrphanedWorkflowRuns", () => {
  test("re-dispatches queued orphans older than the grace window", async () => {
    findMany.mockResolvedValue([runRow("run1", orphaned), runRow("run2", orphaned)]);

    const result = await reconcile();

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({
      workflowRunId: "run1",
      workflowId: "wf_run1",
      workspaceId: "ws_run1",
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 2, redispatched: 2, agedOutFailed: 0 });
  });

  test("scopes the scan to queued, non-dry-run runs past the grace window, oldest first and bounded", async () => {
    findMany.mockResolvedValue([]);

    await reconcile();

    const args = findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: "queued", isDryRun: false });
    expect(args.where.createdAt.lt).toEqual(new Date(NOW.getTime() - 2 * 60 * 1000));
    expect(args.orderBy).toEqual({ createdAt: "asc" });
    expect(args.take).toBe(250);
  });

  test("marks a run past the age ceiling as failed (status-guarded) and never re-dispatches it", async () => {
    findMany.mockResolvedValue([runRow("stuck", ancient)]);

    const result = await reconcile();

    expect(dispatch).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "stuck", status: "queued" },
      data: expect.objectContaining({ status: "failed", finishedAt: NOW, lastErrorAt: NOW }),
    });
    expect(result).toEqual({ scanned: 1, redispatched: 0, agedOutFailed: 1 });
  });

  test("does not count an aged-out run that lost the status-guard race", async () => {
    findMany.mockResolvedValue([runRow("stuck", ancient)]);
    updateMany.mockResolvedValue({ count: 0 }); // concurrently claimed queued → running

    const result = await reconcile();

    expect(result).toEqual({ scanned: 1, redispatched: 0, agedOutFailed: 0 });
  });

  test("isolates a per-run dispatch failure and continues the sweep", async () => {
    findMany.mockResolvedValue([runRow("bad", orphaned), runRow("good", orphaned)]);
    dispatch.mockRejectedValueOnce(new Error("redis down"));

    const result = await reconcile();

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 2, redispatched: 1, agedOutFailed: 0 });
  });

  test("does nothing when there are no orphans", async () => {
    findMany.mockResolvedValue([]);

    const result = await reconcile();

    expect(dispatch).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, redispatched: 0, agedOutFailed: 0 });
  });
});
