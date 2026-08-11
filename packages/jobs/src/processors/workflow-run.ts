import { createMissingOverrideHandler } from "@/src/processors/missing-override";
import type { TWorkflowRunJobData } from "@/src/types";

/**
 * Default handle for `workflow-run.process`. Run execution lives in `apps/web` and is registered as a
 * runtime override (ENG-1228); this fallback only runs when no override is wired, so it logs and throws
 * rather than silently dropping the run.
 */
export const processWorkflowRunJob = createMissingOverrideHandler<TWorkflowRunJobData>(
  "workflow run",
  (data) => ({
    workflowId: data.workflowId,
    workflowRunId: data.workflowRunId,
    workspaceId: data.workspaceId,
  })
);
