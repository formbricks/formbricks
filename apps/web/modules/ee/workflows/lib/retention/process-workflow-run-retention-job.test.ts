import { beforeEach, describe, expect, test, vi } from "vitest";
import { processWorkflowRunRetentionJob } from "./process-workflow-run-retention-job";

const { runWorkflowRunRetention, info, debug, env } = vi.hoisted(() => ({
  runWorkflowRunRetention: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  env: { WORKFLOW_RUN_DATA_RETENTION_DAYS: 90 },
}));

vi.mock("./run-retention", () => ({ runWorkflowRunRetention }));
vi.mock("@/lib/env", () => ({ env }));
vi.mock("@formbricks/logger", () => ({ logger: { info, debug } }));

const context = {
  attempt: 1,
  jobId: "job_1",
  jobName: "workflow-run.retention",
  maxAttempts: 3,
  queueName: "background-jobs",
};
const data = { scope: "global" } as const;
const nothing = { runContentCleared: 0, testRunsDeleted: 0, samplesDeleted: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  env.WORKFLOW_RUN_DATA_RETENTION_DAYS = 90;
  runWorkflowRunRetention.mockResolvedValue(nothing);
});

describe("processWorkflowRunRetentionJob", () => {
  test("runs the retention with the configured period", async () => {
    env.WORKFLOW_RUN_DATA_RETENTION_DAYS = 30;

    await processWorkflowRunRetentionJob(data, context);

    expect(runWorkflowRunRetention).toHaveBeenCalledWith({ now: expect.any(Date), retentionDays: 30 });
  });

  test("logs at info with the counts when it changed anything", async () => {
    runWorkflowRunRetention.mockResolvedValue({ ...nothing, samplesDeleted: 2 });

    await processWorkflowRunRetentionJob(data, context);

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ samplesDeleted: 2, retentionDays: 90, jobId: "job_1" }),
      expect.any(String)
    );
    expect(debug).not.toHaveBeenCalled();
  });

  test("logs at debug when there was nothing to do", async () => {
    await processWorkflowRunRetentionJob(data, context);

    expect(debug).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
  });

  test("fails the job when the retention throws, so BullMQ retries", async () => {
    runWorkflowRunRetention.mockRejectedValue(new Error("db down"));

    await expect(processWorkflowRunRetentionJob(data, context)).rejects.toThrow("db down");
  });
});
