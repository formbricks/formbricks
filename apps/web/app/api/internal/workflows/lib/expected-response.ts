import "server-only";
import { prisma } from "@formbricks/database";
import {
  type TSetWorkflowExpectedResponseInput,
  type TWorkflowSampleListItem,
  type TWorkflowTestRequestParams,
  checkWebhookPayloadShape,
} from "@formbricks/workflows";
import {
  WorkflowInvalidInputError,
  assertNotArchived,
  loadAndAuthorize,
  toProblemResponse,
} from "@formbricks/workflows/server";
import { problemNotFound, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext, workflowsService } from "@/app/api/v3/workflows/lib/context";

/**
 * Saves an HTTP request step's expected response (ADR 0054) as the step's sample, in the shape a Test
 * request response has, so the Variables and a Test run read it unchanged: status 200, JSON. The step
 * must be an HTTP request in the draft; the body follows the expected payload's limits.
 */
export const setWorkflowExpectedResponse = async ({
  authentication,
  requestId,
  instance,
  params,
  input,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  params: TWorkflowTestRequestParams;
  input: TSetWorkflowExpectedResponseInput;
}): Promise<Response> => {
  const ctx = buildWorkflowApiContext(authentication, requestId, instance);
  try {
    const workflow = await loadAndAuthorize(workflowsService, ctx, params.workflowId, "readWrite");
    if (workflow instanceof Response) return workflow;
    assertNotArchived(workflow);

    const step = workflow.definition.nodes.find((node) => node.id === params.stepId);
    if (step?.type !== "action" || step.actionType !== "http_request") {
      return problemNotFound(requestId, "HTTP request step", params.stepId, instance);
    }
    const check = checkWebhookPayloadShape(input.body);
    if (!check.ok) throw new WorkflowInvalidInputError(`The expected response is ${check.reason}`);

    const sample = {
      status: 200,
      contentType: "application/json",
      body: check.payload,
      bodyTruncated: false,
    };
    const row = await prisma.workflowSample.upsert({
      where: { workflowId_source: { workflowId: workflow.id, source: params.stepId } },
      create: { workflowId: workflow.id, workspaceId: workflow.workspaceId, source: params.stepId, sample },
      update: { sample },
      select: { source: true, sample: true, updatedAt: true },
    });
    const data: TWorkflowSampleListItem = {
      source: row.source,
      sample: row.sample as TWorkflowSampleListItem["sample"],
      updatedAt: row.updatedAt.toISOString(),
    };
    return successResponse(data, { requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
