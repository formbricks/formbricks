import { mockCaptureWorkflowRunFailed } from "@/modules/ee/workflows/lib/analytics/__mocks__/run-failure";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import {
  failInterruptedTestRuns,
  failStuckSendingHttpRequests,
  reconcileStuckRunningWorkflowRuns,
} from "./reconcile-stuck-running-runs";

const { runFindMany, runUpdateMany, logUpdateMany, logFindMany } = vi.hoisted(() => ({
  runFindMany: vi.fn(),
  runUpdateMany: vi.fn(),
  logUpdateMany: vi.fn(),
  logFindMany: vi.fn(),
}));
const { warn, error } = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }));
const prismaMock = vi.hoisted(() => {
  const prisma: {
    workflowRun: { findMany: typeof runFindMany; updateMany: typeof runUpdateMany };
    workflowRunLog: { updateMany: typeof logUpdateMany; findMany: typeof logFindMany };
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  } = {
    workflowRun: { findMany: runFindMany, updateMany: runUpdateMany },
    workflowRunLog: { updateMany: logUpdateMany, findMany: logFindMany },
    $transaction: async (fn) => fn(prisma),
  };
  return prisma;
});

vi.mock("@formbricks/database", () => ({ prisma: prismaMock }));
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
  triggerType: "response.completed",
  attempt: 3,
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
    // This reconciler is a writer of a terminal `failed`, so the run reaches `workflow_run_failed`
    // as well as the snapshot's `runs_24h_failed`; without it the two disagree by exactly the
    // infrastructure failures.
    expect(mockCaptureWorkflowRunFailed).toHaveBeenCalledWith({
      runId: "run1",
      workflowId: "wf_run1",
      workspaceId: "ws_run1",
      triggerType: "response.completed",
      errorKind: "abandoned_mid_execution",
      attempt: 3,
    });
  });

  test("leaves a run that lost the status-guard race untouched (owner finalized it concurrently)", async () => {
    runFindMany.mockResolvedValue([runRow("run1", stale)]);
    runUpdateMany.mockResolvedValue({ count: 0 }); // run no longer `running`

    const result = await reconcile();

    expect(logUpdateMany).not.toHaveBeenCalled(); // never skip steps of a run we didn't claim
    expect(warn).not.toHaveBeenCalled();
    // Losing the claim means another writer owns the verdict: it reports, this sweep must not.
    expect(mockCaptureWorkflowRunFailed).not.toHaveBeenCalled();
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

describe("failStuckSendingHttpRequests", () => {
  const sendingRow = (id: string) => ({
    id,
    runId: `run_${id}`,
    stepId: "call",
    output: { mode: "dont_wait", delivery: "sending", request: { method: "POST", url: "https://x.example" } },
  });

  test("finds Don't wait HTTP requests still sending after an hour, oldest first and bounded", async () => {
    logFindMany.mockResolvedValue([]);

    await failStuckSendingHttpRequests({ now: NOW });

    const args = logFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      status: "running",
      stepType: "http_request",
      output: { path: ["delivery"], equals: "sending" },
    });
    expect(args.where.startedAt.lt).toEqual(new Date(NOW.getTime() - 60 * 60 * 1000));
    expect(args.orderBy).toEqual({ startedAt: "asc" });
    expect(args.take).toBe(250);
  });

  test("marks each one failed, keeping what it recorded and guarded on still running", async () => {
    logFindMany.mockResolvedValue([sendingRow("log1")]);
    logUpdateMany.mockResolvedValue({ count: 1 });

    const result = await failStuckSendingHttpRequests({ now: NOW });

    expect(logUpdateMany).toHaveBeenCalledWith({
      where: { id: "log1", status: "running" },
      data: {
        status: "failed",
        error: expect.stringMatching(/hour/),
        finishedAt: NOW,
        output: { ...sendingRow("log1").output, delivery: "failed" },
      },
    });
    expect(result).toEqual({ scanned: 1, failed: 1 });
  });

  test("logs a database error by name and code, never its message, and goes on with the batch", async () => {
    logFindMany.mockResolvedValue([sendingRow("log1"), sendingRow("log2")]);
    // A Prisma message can quote the values it tried to write, here the step's recorded request.
    const dbError = new Prisma.PrismaClientKnownRequestError("value too long: https://x.example/secret", {
      code: "P2000",
      clientVersion: "test",
    });
    logUpdateMany.mockRejectedValueOnce(dbError).mockResolvedValueOnce({ count: 1 });

    const result = await failStuckSendingHttpRequests({ now: NOW });

    expect(result).toEqual({ scanned: 2, failed: 1 });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        errName: "PrismaClientKnownRequestError",
        code: "P2000",
        workflowRunId: "run_log1",
      }),
      expect.any(String)
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret");
  });

  test("lets an unexpected error through instead of swallowing it", async () => {
    logFindMany.mockResolvedValue([sendingRow("log1")]);
    logUpdateMany.mockRejectedValueOnce(new TypeError("boom"));

    await expect(failStuckSendingHttpRequests({ now: NOW })).rejects.toThrow("boom");
  });
});

describe("failInterruptedTestRuns", () => {
  const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);
  interface FakeRun {
    id: string;
    workspaceId: string;
    isDryRun: boolean;
    status: string;
    createdAt: Date;
    error?: string;
  }
  let runs: FakeRun[];
  const run = (id: string, isDryRun: boolean, status: string, createdAt: Date): FakeRun => ({
    id,
    workspaceId: `ws_${id}`,
    isDryRun,
    status,
    createdAt,
  });

  // The runs table as the sweep's filters see it, so the test checks which runs it ends, not its query.
  type RunWhere = {
    id?: string | { in: string[] };
    workspaceId?: string;
    isDryRun?: boolean;
    status?: { in: string[] };
    createdAt?: { lt: Date };
  };
  const idMatches = (where: RunWhere, id: string) =>
    where.id === undefined || (typeof where.id === "string" ? where.id === id : where.id.in.includes(id));
  const matching = (where: RunWhere) =>
    runs.filter(
      (row) =>
        idMatches(where, row.id) &&
        (where.workspaceId === undefined || row.workspaceId === where.workspaceId) &&
        (where.isDryRun === undefined || row.isDryRun === where.isDryRun) &&
        (where.status === undefined || where.status.in.includes(row.status)) &&
        (where.createdAt === undefined || row.createdAt < where.createdAt.lt)
    );
  const skippedStepRuns = () =>
    logUpdateMany.mock.calls.map((call) => (call[0] as { where: { runId: string } }).where.runId).sort();

  beforeEach(() => {
    runs = [
      run("test_queued", true, "queued", minutesAgo(11)),
      run("test_running", true, "running", minutesAgo(30)),
      run("test_young", true, "running", minutesAgo(9)),
      run("test_done", true, "completed", minutesAgo(60)),
      run("real_queued", false, "queued", minutesAgo(120)),
      run("real_running", false, "running", minutesAgo(120)),
    ];
    runFindMany.mockImplementation(
      async ({
        where,
        orderBy,
        take,
      }: {
        where: RunWhere;
        orderBy?: { createdAt: "asc" | "desc" };
        take?: number;
      }) => {
        const hit = matching(where);
        if (orderBy) {
          const direction = orderBy.createdAt === "asc" ? 1 : -1;
          hit.sort((a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()));
        }
        return hit.slice(0, take).map(({ id, workspaceId }) => ({ id, workspaceId }));
      }
    );
    runUpdateMany.mockImplementation(async ({ where, data }: { where: RunWhere; data: Partial<FakeRun> }) => {
      const hit = matching(where);
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    });
    logUpdateMany.mockResolvedValue({ count: 1 });
  });

  const statusOf = (id: string) => runs.find((row) => row.id === id);

  test("fails a Test run still queued or running after 10 minutes, in one sweep", async () => {
    const result = await failInterruptedTestRuns({ now: NOW });

    for (const id of ["test_queued", "test_running"]) {
      expect(statusOf(id)).toMatchObject({ status: "failed", error: "Test run was interrupted" });
    }
    expect(skippedStepRuns()).toEqual(["test_queued", "test_running"]);
    expect(logUpdateMany.mock.calls[0][0].where.status).toBe("running");
    expect(logUpdateMany.mock.calls[0][0].data).toEqual({
      status: "skipped",
      error: "Test run was interrupted",
      finishedAt: NOW,
    });
    expect(result).toEqual({ scanned: 2, failed: 2 });
  });

  test("writes each run only within the workspace it was found in", async () => {
    await failInterruptedTestRuns({ now: NOW });

    for (const [args] of runUpdateMany.mock.calls) {
      expect(args.where.workspaceId).toBe(`ws_${args.where.id as string}`);
    }
    for (const [args] of logUpdateMany.mock.calls) {
      expect(args.where.run).toEqual({ workspaceId: `ws_${args.where.runId as string}` });
    }
  });

  test("leaves a Test run younger than 10 minutes, a finished one, and every real run untouched", async () => {
    await failInterruptedTestRuns({ now: NOW });

    expect(statusOf("test_young")?.status).toBe("running");
    expect(statusOf("test_done")?.status).toBe("completed");
    expect(statusOf("real_queued")?.status).toBe("queued");
    expect(statusOf("real_running")?.status).toBe("running");
  });

  test("is not reported as a workflow failure", async () => {
    await failInterruptedTestRuns({ now: NOW });

    expect(mockCaptureWorkflowRunFailed).not.toHaveBeenCalled();
  });

  test("ends at most 250 runs per sweep, oldest first, and leaves the rest for the next one", async () => {
    // Seeded newest first, so only a scan that asks for the oldest first ends the oldest run.
    runs = Array.from({ length: 251 }, (_, index) =>
      run(`test_${index.toString()}`, true, "running", minutesAgo(50 + index))
    );

    const result = await failInterruptedTestRuns({ now: NOW });

    expect(result).toEqual({ scanned: 250, failed: 250 });
    expect(statusOf("test_250")?.status).toBe("failed");
    expect(statusOf("test_0")?.status).toBe("running");
  });

  test("a run that can't be written rolls back alone and stays eligible; the others still end", async () => {
    logUpdateMany.mockImplementation(async ({ where }: { where: { runId: string } }) => {
      if (where.runId === "test_running") throw new Error("lock timeout");
      return { count: 1 };
    });
    const transaction = prismaMock.$transaction;
    const snapshot = new Map<string, FakeRun>();
    prismaMock.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => {
      for (const row of runs) snapshot.set(row.id, { ...row });
      try {
        return await fn(prismaMock);
      } catch (error) {
        runs = runs.map((row) => snapshot.get(row.id) ?? row);
        throw error;
      }
    };

    try {
      const result = await failInterruptedTestRuns({ now: NOW });

      expect(statusOf("test_queued")?.status).toBe("failed");
      expect(statusOf("test_running")?.status).toBe("running");
      expect(result).toEqual({ scanned: 2, failed: 1 });
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ workflowRunId: "test_running" }),
        "Could not mark an interrupted Test run failed"
      );
    } finally {
      prismaMock.$transaction = transaction;
    }
  });

  test("does nothing when no Test run was interrupted", async () => {
    runs = runs.filter((row) => !["test_queued", "test_running"].includes(row.id));

    const result = await failInterruptedTestRuns({ now: NOW });

    expect(runUpdateMany).not.toHaveBeenCalled();
    expect(logUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, failed: 0 });
  });
});
