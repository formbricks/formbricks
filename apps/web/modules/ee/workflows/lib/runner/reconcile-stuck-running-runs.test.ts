import { beforeEach, describe, expect, test, vi } from "vitest";
import { reconcileStuckRunningWorkflowRuns } from "./reconcile-stuck-running-runs";

const { runFindMany, runUpdateMany, logUpdateMany } = vi.hoisted(() => ({
  runFindMany: vi.fn(),
  runUpdateMany: vi.fn(),
  logUpdateMany: vi.fn(),
}));
const { warn, error } = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workflowRun: { findMany: runFindMany, updateMany: runUpdateMany },
    workflowRunLog: { updateMany: logUpdateMany },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn, error } }));

const NOW = new Date("2026-07-01T12:00:00.000Z");
// Stale threshold is 1h (see reconcile-constants). 2h since the last executor write → abandoned.
const stale = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);

const runRow = (id: string, updatedAt: Date) => ({
  id,
  workflowId: `wf_${id}`,
  workspaceId: `ws_${id}`,
  startedAt: new Date(updatedAt.getTime() - 60 * 1000),
  updatedAt,
});

const reconcile = () => reconcileStuckRunningWorkflowRuns({ now: NOW });

beforeEach(() => {
  vi.clearAllMocks();
  runUpdateMany.mockResolvedValue({ count: 1 }); // claimed the run for failure
  logUpdateMany.mockResolvedValue({ count: 2 }); // two orphaned steps skipped
});

describe("reconcileStuckRunningWorkflowRuns", () => {
  test("scopes the scan to running, non-dry-run runs stale past the threshold, oldest first and bounded", async () => {
    runFindMany.mockResolvedValue([]);

    await reconcile();

    const args = runFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: "running", isDryRun: false });
    expect(args.where.updatedAt.lt).toEqual(new Date(NOW.getTime() - 60 * 60 * 1000));
    expect(args.orderBy).toEqual({ updatedAt: "asc" });
    expect(args.take).toBe(250);
  });

  test("recovers a stale run: marks it failed (status-guarded) and skips its orphaned running steps", async () => {
    runFindMany.mockResolvedValue([runRow("run1", stale)]);

    const result = await reconcile();

    expect(runUpdateMany).toHaveBeenCalledWith({
      where: { id: "run1", workspaceId: "ws_run1", status: "running" },
      data: expect.objectContaining({ status: "failed", lastErrorAt: NOW, finishedAt: NOW }),
    });
    expect(logUpdateMany).toHaveBeenCalledWith({
      where: { runId: "run1", status: "running" },
      data: expect.objectContaining({ status: "skipped", finishedAt: NOW }),
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 1, recovered: 1, stepsSkipped: 2 });
  });

  test("leaves a run that lost the status-guard race untouched (owner finalized it concurrently)", async () => {
    runFindMany.mockResolvedValue([runRow("run1", stale)]);
    runUpdateMany.mockResolvedValue({ count: 0 }); // run no longer `running`

    const result = await reconcile();

    expect(logUpdateMany).not.toHaveBeenCalled(); // never skip steps of a run we didn't claim
    expect(warn).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, recovered: 0, stepsSkipped: 0 });
  });

  test("recovers a run that crashed before its first step was claimed (no running steps to skip)", async () => {
    runFindMany.mockResolvedValue([runRow("run1", stale)]);
    logUpdateMany.mockResolvedValue({ count: 0 });

    const result = await reconcile();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 1, recovered: 1, stepsSkipped: 0 });
  });

  test("isolates a per-run recovery failure and continues the sweep", async () => {
    runFindMany.mockResolvedValue([runRow("bad", stale), runRow("good", stale)]);
    runUpdateMany.mockRejectedValueOnce(new Error("db down")).mockResolvedValue({ count: 1 });
    logUpdateMany.mockResolvedValue({ count: 1 });

    const result = await reconcile();

    expect(error).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 2, recovered: 1, stepsSkipped: 1 });
  });

  test("still counts the run as recovered when the step-skip write fails after a won claim", async () => {
    // The documented cosmetic gap: run already marked failed, step flip dies. The failed run is
    // unreachable (terminal-status guard), so the sweep just logs and moves on — no retry, no warn.
    runFindMany.mockResolvedValue([runRow("run1", stale)]);
    logUpdateMany.mockRejectedValueOnce(new Error("db down"));

    const result = await reconcile();

    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, recovered: 1, stepsSkipped: 0 });
  });

  test("does nothing when there are no stuck running runs", async () => {
    runFindMany.mockResolvedValue([]);

    const result = await reconcile();

    expect(runUpdateMany).not.toHaveBeenCalled();
    expect(logUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, recovered: 0, stepsSkipped: 0 });
  });
});
