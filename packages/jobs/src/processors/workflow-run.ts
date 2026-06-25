import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TWorkflowRunJobData } from "@/src/types";

/**
 * Default handle for `workflow-run.process`. Run execution lives in `apps/web` and is registered as a
 * runtime override (ENG-1228); this fallback only runs when no override is wired, so it logs and
 * throws rather than silently dropping the run. Mirrors the response-pipeline fallback processor.
 */
export const processWorkflowRunJob: JobHandler<TWorkflowRunJobData> = (data, context) => {
  logger.error(
    {
      attempt: context.attempt,
      workflowRunId: data.workflowRunId,
      workflowId: data.workflowId,
      workspaceId: data.workspaceId,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "BullMQ workflow run processor override is not registered"
  );

  throw new Error(
    `BullMQ workflow run processor override missing for job ${context.jobId} (${data.workspaceId}/${data.workflowRunId})`
  );
};
