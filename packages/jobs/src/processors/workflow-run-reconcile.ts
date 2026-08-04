import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TWorkflowRunReconcileJobData } from "@/src/types";

export const processWorkflowRunReconcileJob: JobHandler<TWorkflowRunReconcileJobData> = (data, context) => {
  logger.error(
    {
      attempt: context.attempt,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
      scope: data.scope,
    },
    "BullMQ workflow run reconcile processor override is not registered"
  );

  throw new Error(
    `BullMQ workflow run reconcile processor override missing for job ${context.jobId} (${data.scope})`
  );
};
