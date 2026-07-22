import { enqueueWorkflowRunJob } from "@formbricks/jobs";

export interface WorkflowRunDispatch {
  workflowRunId: string;
  workflowId: string;
  workspaceId: string;
}

/**
 * Hands a persisted, `queued` WorkflowRun off to the task backend for processing. The runner depends
 * only on this port — the WorkflowRun row is the durable, backend-neutral source of truth — so moving
 * off BullMQ to another backend is a one-file change here, not a rewrite of matching/run-creation.
 */
export type DispatchWorkflowRun = (input: WorkflowRunDispatch) => Promise<void>;

/**
 * BullMQ-backed dispatcher: enqueues `workflow-run.process` with a deterministic `jobId` (the run id)
 * so a replayed enqueue is idempotent at the queue level (no duplicate job).
 */
export const dispatchWorkflowRunViaJobs: DispatchWorkflowRun = async (input) => {
  await enqueueWorkflowRunJob(input, { jobId: input.workflowRunId });
};
