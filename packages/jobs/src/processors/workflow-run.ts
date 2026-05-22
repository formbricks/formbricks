import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TWorkflowRunJobData } from "@/src/types";

export const processWorkflowRunJob: JobHandler<TWorkflowRunJobData> = (data, context) => {
  logger.error(
    {
      attempt: context.attempt,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
      workflowId: data.workflowId,
      workflowRunId: data.workflowRunId,
      workspaceId: data.workspaceId,
    },
    "BullMQ workflow run processor override is not registered"
  );

  throw new Error(
    `BullMQ workflow run processor override missing for job ${context.jobId} (${data.workspaceId}/${data.workflowRunId})`
  );
};
