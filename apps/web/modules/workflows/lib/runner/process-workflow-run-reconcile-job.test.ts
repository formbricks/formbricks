import { beforeEach, describe, expect, test, vi } from "vitest";
import { processWorkflowRunReconcileJob } from "./process-workflow-run-reconcile-job";

const { reconcileOrphanedWorkflowRuns, dispatchWorkflowRunViaJobs, info, debug } = vi.hoisted(() => ({
  reconcileOrphanedWorkflowRuns: vi.fn(),
  dispatchWorkflowRunViaJobs: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("./reconcile-orphaned-runs", () => ({ reconcileOrphanedWorkflowRuns }));
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processWorkflowRunReconcileJob", () => {
  test("runs the reconciler with the real dispatch port + clock and logs a summary when it re-dispatched", async () => {
    reconcileOrphanedWorkflowRuns.mockResolvedValue({ scanned: 3, redispatched: 2, agedOutFailed: 0 });

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
    expect(info).toHaveBeenCalledTimes(1);
    expect(debug).not.toHaveBeenCalled();
  });

  test("logs at info when only aged-out runs were failed", async () => {
    reconcileOrphanedWorkflowRuns.mockResolvedValue({ scanned: 1, redispatched: 0, agedOutFailed: 1 });

    await processWorkflowRunReconcileJob(data, context);

    expect(info).toHaveBeenCalledTimes(1);
    expect(debug).not.toHaveBeenCalled();
  });

  test("logs at debug when the sweep found nothing", async () => {
    reconcileOrphanedWorkflowRuns.mockResolvedValue({ scanned: 0, redispatched: 0, agedOutFailed: 0 });

    await processWorkflowRunReconcileJob(data, context);

    expect(debug).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
  });
});
