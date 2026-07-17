import { beforeEach, describe, expect, test, vi } from "vitest";
import { reconcileOrphanedWorkflowRuns } from "./reconcile-orphaned-runs";

const { findMany, updateMany } = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn() }));
const { markDispatched } = vi.hoisted(() => ({ markDispatched: vi.fn() }));
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
vi.mock("./mark-dispatched", () => ({ markWorkflowRunDispatched: markDispatched }));

const NOW = new Date("2026-07-01T12:00:00.000Z");
// Grace window is 2 min, ceiling is 24 h (see reconcile-constants).
const orphaned = new Date(NOW.getTime() - 10 * 60 * 1000); // 10 min old → eligible orphan
const ancient = new Date(NOW.getTime() - 25 * 60 * 60 * 1000); // 25 h old → past the ceiling

const dispatch =
  vi.fn<(input: { workflowRunId: string; workflowId: string; workspaceId: string }) => Promise<void>>();

// dispatchedAt defaults to null: a genuine never-handed-off producer orphan.
const runRow = (id: string, createdAt: Date, dispatchedAt: Date | null = null) => ({
  id,
  workflowId: `wf_${id}`,
  workspaceId: `ws_${id}`,
  createdAt,
  dispatchedAt,
});

const reconcile = () => reconcileOrphanedWorkflowRuns({ dispatch, now: NOW });

beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockResolvedValue(undefined);
  updateMany.mockResolvedValue({ count: 1 });
  markDispatched.mockResolvedValue(undefined);
});

describe("reconcileOrphanedWorkflowRuns", () => {
  test("re-dispatches queued orphans older than the grace window and stamps the never-dispatched ones", async () => {
    findMany.mockResolvedValue([runRow("run1", orphaned), runRow("run2", orphaned)]);

    const result = await reconcile();

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({
      workflowRunId: "run1",
      workflowId: "wf_run1",
      workspaceId: "ws_run1",
    });
    // Both were dispatchedAt: null → genuine orphans → stamped with the injected clock.
    expect(markDispatched).toHaveBeenCalledTimes(2);
    expect(markDispatched).toHaveBeenCalledWith(
      "run1",
      NOW,
      expect.objectContaining({ workflowRunId: "run1" })
    );
    expect(updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 2, redispatched: 2, agedOutFailed: 0, neverDispatched: 2 });
  });

  test("re-dispatches an already-dispatched-but-still-queued run without counting or re-stamping it", async () => {
    findMany.mockResolvedValue([runRow("lagging", orphaned, new Date(NOW.getTime() - 5 * 60 * 1000))]);

    const result = await reconcile();

    expect(dispatch).toHaveBeenCalledTimes(1); // still re-dispatched (idempotent, preserves Redis-loss recovery)
    expect(markDispatched).not.toHaveBeenCalled(); // dispatchedAt already set → no churn on the marker
    expect(result).toEqual({ scanned: 1, redispatched: 1, agedOutFailed: 0, neverDispatched: 0 });
  });

  test("scopes the scan to queued, non-dry-run runs past the grace window, selecting dispatchedAt, oldest first and bounded", async () => {
    findMany.mockResolvedValue([]);

    await reconcile();

    const args = findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: "queued", isDryRun: false });
    expect(args.where.createdAt.lt).toEqual(new Date(NOW.getTime() - 2 * 60 * 1000));
    expect(args.select).toMatchObject({ dispatchedAt: true });
    expect(args.orderBy).toEqual({ createdAt: "asc" });
    expect(args.take).toBe(250);
  });

  test("marks a run past the age ceiling as failed (status-guarded) and never re-dispatches it", async () => {
    findMany.mockResolvedValue([runRow("stuck", ancient)]);

    const result = await reconcile();

    expect(dispatch).not.toHaveBeenCalled();
    expect(markDispatched).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "stuck", status: "queued" },
      data: expect.objectContaining({ status: "failed", finishedAt: NOW, lastErrorAt: NOW }),
    });
    expect(result).toEqual({ scanned: 1, redispatched: 0, agedOutFailed: 1, neverDispatched: 0 });
  });

  test("does not count an aged-out run that lost the status-guard race", async () => {
    findMany.mockResolvedValue([runRow("stuck", ancient)]);
    updateMany.mockResolvedValue({ count: 0 }); // concurrently claimed queued → running

    const result = await reconcile();

    expect(result).toEqual({ scanned: 1, redispatched: 0, agedOutFailed: 0, neverDispatched: 0 });
  });

  test("isolates a per-run dispatch failure and continues the sweep", async () => {
    findMany.mockResolvedValue([runRow("bad", orphaned), runRow("good", orphaned)]);
    dispatch.mockRejectedValueOnce(new Error("redis down"));

    const result = await reconcile();

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    // Only the successfully re-dispatched "good" run is counted + stamped.
    expect(markDispatched).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 2, redispatched: 1, agedOutFailed: 0, neverDispatched: 1 });
  });

  test("does nothing when there are no orphans", async () => {
    findMany.mockResolvedValue([]);

    const result = await reconcile();

    expect(dispatch).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(markDispatched).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, redispatched: 0, agedOutFailed: 0, neverDispatched: 0 });
  });
});
