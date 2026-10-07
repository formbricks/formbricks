import "server-only";
import { logger } from "@formbricks/logger";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { WORKFLOW_RUN_FAILED_EVENT } from "../analytics-events";

export interface WorkflowRunFailureFacts {
  runId: string;
  workflowId: string;
  workspaceId: string;
  triggerType: string;
  /** The step that failed, where one did: a run the reconcilers finalize has no failed step. */
  failedStepType?: string | null;
  /** Coarse, PII-free failure class; the error message itself can name a recipient. */
  errorKind: string;
  attempt: number;
}

/**
 * Product analytics (ENG-2851): one `workflow_run_failed` per run that ends `failed`. Every writer
 * of a terminal `failed` calls this — the runner's final attempt and both reconcilers — because a
 * run abandoned by a dead pod or left undispatched still counts in the daily snapshot's
 * `runs_24h_failed`, and an event that only the runner emitted would make the two disagree by
 * exactly the infrastructure failures. Retries never emit, so the failure rate is per run.
 *
 * Never throws: the caller has already committed the terminal failure and this sits on its swallow
 * path, so a telemetry problem must not become a job error.
 */
export const captureWorkflowRunFailed = async (facts: WorkflowRunFailureFacts): Promise<void> => {
  try {
    const organization = await getOrganizationByWorkspaceId(facts.workspaceId);
    capturePostHogEvent(
      organization?.id ?? facts.workspaceId,
      WORKFLOW_RUN_FAILED_EVENT,
      {
        workflow_id: facts.workflowId,
        workspace_id: facts.workspaceId,
        organization_id: organization?.id ?? null,
        run_id: facts.runId,
        trigger_type: facts.triggerType,
        failed_step_type: facts.failedStepType ?? null,
        error_kind: facts.errorKind,
        attempt: facts.attempt,
      },
      { organizationId: organization?.id, workspaceId: facts.workspaceId }
    );
  } catch (analyticsError) {
    logger.warn(
      { workflowRunId: facts.runId, err: analyticsError },
      "Failed to capture workflow run failure analytics"
    );
  }
};
