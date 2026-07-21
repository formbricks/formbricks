import { describe, expect, test, vi } from "vitest";
import { dispatchWorkflowRunViaJobs } from "./dispatch";

const { enqueueWorkflowRunJob } = vi.hoisted(() => ({ enqueueWorkflowRunJob: vi.fn() }));
vi.mock("@formbricks/jobs", () => ({ enqueueWorkflowRunJob }));

describe("dispatchWorkflowRunViaJobs", () => {
  test("enqueues the run with a deterministic jobId equal to the run id", async () => {
    enqueueWorkflowRunJob.mockResolvedValue({ id: "job_1" });

    await dispatchWorkflowRunViaJobs({ workflowRunId: "run_1", workflowId: "wf_1", workspaceId: "ws_1" });

    expect(enqueueWorkflowRunJob).toHaveBeenCalledWith(
      { workflowRunId: "run_1", workflowId: "wf_1", workspaceId: "ws_1" },
      { jobId: "run_1" }
    );
  });
});
