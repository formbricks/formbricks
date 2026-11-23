import { createMissingOverrideHandler } from "@/src/processors/missing-override";
import type { TWorkflowHttpRequestDeliveryJobData } from "@/src/types";

/**
 * Default handle for `workflow-http-request.deliver`. The real call (a workflow HTTP request step set
 * to "Don't wait") lives in `apps/web` and is registered as a runtime override; this fallback only runs
 * when no override is wired, so it logs and throws rather than silently dropping the call.
 */
export const processWorkflowHttpRequestDeliveryJob =
  createMissingOverrideHandler<TWorkflowHttpRequestDeliveryJobData>(
    "workflow HTTP request delivery",
    (data) => ({
      stepId: data.stepId,
      workflowId: data.workflowId,
      workflowRunId: data.workflowRunId,
      workspaceId: data.workspaceId,
    })
  );
