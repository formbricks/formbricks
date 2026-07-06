import { beforeEach, describe, expect, test, vi } from "vitest";
import { processWorkflowRunReconcileJob } from "./process-workflow-run-reconcile-job";

const {
  reconcileOrphanedWorkflowRuns,
  reconcileStuckRunningWorkflowRuns,
  dispatchWorkflowRunViaJobs,
  info,
  debug,
} = vi.hoisted(() => ({
  reconcileOrphanedWorkflowRuns: vi.fn(),
  reconcileStuckRunningWorkflowRuns: vi.fn(),
  dispatchWorkflowRunViaJobs: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("./reconcile-orphaned-runs", () => ({ reconcileOrphanedWorkflowRuns }));
vi.mock("./reconcile-stuck-running-runs", () => ({ reconcileStuckRunningWorkflowRuns }));
vi.mock("./dispatch", () => ({ dispatchWorkflowRunViaJobs }));
vi.mock("@formbricks/logger", () => ({ logger: { info, debug } }));

const context = {
  attempt: 1,
  jobId: "job_1",
  jobName: "workflow-run.reconcile",
  maxAttempts: 3,
  queueName: "background-jobs",
};

const data = { scope: "global" } as const;

const noQueuedWork = { scanned: 0, redispatched: 0, agedOutFailed: 0 };
const noStuckWork = { scanned: 0, recovered: 0, stepsSkipped: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  reconcileOrphanedWorkflowRuns.mockResolvedValue(noQueuedWork);
  reconcileStuckRunningWorkflowRuns.mockResolvedValue(noStuckWork);
});

describe("processWorkflowRunReconcileJob", () => {
  test("runs both sweeps against one shared clock (queued sweep gets the real dispatch port)", async () => {
    await processWorkflowRunReconcileJob(data, context);

    expect(reconcileOrphanedWorkflowRuns).toHaveBeenCalledWith({
      dispatch: dispatchWorkflowRunViaJobs,
      now: expect.any(Date),
      logContext: expect.objectContaining({
        jobId: "job_1",
        jobName: "workflow-run.reconcile",
        queueName: "background-jobs",
        scope: "global",
      }),
    });
    expect(reconcileStuckRunningWorkflowRuns).toHaveBeenCalledWith({
      now: expect.any(Date),
      logContext: expect.objectContaining({ jobId: "job_1", scope: "global" }),
    });
    // Both sweeps share the same clock instance.
    const queuedNow = reconcileOrphanedWorkflowRuns.mock.calls[0][0].now;
    const stuckNow = reconcileStuckRunningWorkflowRuns.mock.calls[0][0].now;
    expect(stuckNow).toBe(queuedNow);
  });

  test("logs at info when the queued sweep re-dispatched, carrying both sweep results", async () => {
    reconcileOrphanedWorkflowRuns.mockResolvedValue({ scanned: 3, redispatched: 2, agedOutFailed: 0 });

    await processWorkflowRunReconcileJob(data, context);

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        queued: { scanned: 3, redispatched: 2, agedOutFailed: 0 },
        stuckRunning: noStuckWork,
      }),
      expect.any(String)
    );
    expect(debug).not.toHaveBeenCalled();
  });

  test("logs at info when only aged-out (queued) runs were failed", async () => {
    reconcileOrphanedWorkflowRuns.mockResolvedValue({ scanned: 1, redispatched: 0, agedOutFailed: 1 });

    await processWorkflowRunReconcileJob(data, context);

    expect(info).toHaveBeenCalledTimes(1);
    expect(debug).not.toHaveBeenCalled();
  });

  test("logs at info when only the stuck-running sweep recovered", async () => {
    reconcileStuckRunningWorkflowRuns.mockResolvedValue({ scanned: 1, recovered: 1, stepsSkipped: 2 });

    await processWorkflowRunReconcileJob(data, context);

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        queued: noQueuedWork,
        stuckRunning: { scanned: 1, recovered: 1, stepsSkipped: 2 },
      }),
      expect.any(String)
    );
    expect(debug).not.toHaveBeenCalled();
  });

  test("logs at debug when both sweeps found nothing", async () => {
    await processWorkflowRunReconcileJob(data, context);

    expect(debug).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
  });
});
