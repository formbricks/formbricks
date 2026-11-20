import "server-only";
import { prisma } from "@formbricks/database";
import {
  type TWorkflowIdInput,
  type TWorkflowRunIdInput,
  ZWorkflowIdInput,
  ZWorkflowRunIdInput,
} from "@formbricks/workflows";
import { WorkflowForbiddenError, loadAndAuthorize, toProblemResponse } from "@formbricks/workflows/server";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext, workflowsService } from "@/app/api/v3/workflows/lib/context";
import { maskStoredDefinition } from "./mask-stored-definition";

/** The route's params: the workflow and one of its runs. */
export const ZWorkflowRunDefinitionParams = ZWorkflowIdInput.extend(ZWorkflowRunIdInput.shape);
export type TWorkflowRunDefinitionParams = TWorkflowIdInput & TWorkflowRunIdInput;

/**
 * The graph a run executed. A live run's comes from the version it ran, a Test run's from the draft it
 * saved when it was created; `unknown` when neither exists (a Test run saved before the snapshot
 * existed, or a live run whose version is gone).
 */
export type TWorkflowRunDefinition =
  | { source: "version"; versionNumber: number; definition: unknown }
  | { source: "test_run"; definition: unknown }
  | { source: "unknown"; definition: null };

/**
 * `GET /api/internal/workflows/{workflowId}/runs/{runId}/definition`: the definition a run executed,
 * so the Runs tab draws the run on the graph it ran rather than the current draft. Read access, like
 * the run detail. The run must belong to this workflow and workspace; any other id is refused as
 * forbidden, the same answer as an unknown id, so ids from elsewhere never leak.
 */
export const getWorkflowRunDefinition = async ({
  authentication,
  requestId,
  instance,
  params,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  params: TWorkflowRunDefinitionParams;
}): Promise<Response> => {
  const ctx = buildWorkflowApiContext(authentication, requestId, instance);
  try {
    const workflow = await loadAndAuthorize(workflowsService, ctx, params.workflowId, "read");
    if (workflow instanceof Response) return workflow;

    const run = await prisma.workflowRun.findFirst({
      where: { id: params.runId, workflowId: workflow.id, workspaceId: workflow.workspaceId },
      select: {
        testRunDefinition: true,
        workflowVersion: { select: { version: true, definition: true } },
      },
    });
    if (!run) throw new WorkflowForbiddenError();

    let data: TWorkflowRunDefinition;
    if (run.workflowVersion) {
      data = {
        source: "version",
        versionNumber: run.workflowVersion.version,
        definition: maskStoredDefinition(run.workflowVersion.definition),
      };
    } else if (run.testRunDefinition) {
      data = { source: "test_run", definition: maskStoredDefinition(run.testRunDefinition) };
    } else {
      data = { source: "unknown", definition: null };
    }
    return successResponse(data, { requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
