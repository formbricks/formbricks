import "server-only";
import { prisma } from "@formbricks/database";
import {
  type TSetWorkflowExpectedResponseInput,
  type TWorkflowExpectedResponseResource,
  type TWorkflowSampleVariables,
  type TWorkflowTestRequestParams,
  WEBHOOK_PAYLOAD_MAX_BYTES,
  WEBHOOK_PAYLOAD_MAX_DEPTH,
  ZWorkflowExpectedResponseResource,
  checkWebhookPayloadShape,
  detectWebhookVariables,
} from "@formbricks/workflows";
import {
  WorkflowInvalidInputError,
  WorkflowPayloadTooLargeError,
  assertNotArchived,
  loadAndAuthorize,
  toProblemResponse,
} from "@formbricks/workflows/server";
import { problemNotFound, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext, workflowsService } from "./context";

/**
 * The Variables a body offers, under the step's own paths: detection names them as a payload's
 * (`payload.ticket.id`); a later step reads them as `steps.<stepId>.body.ticket.id`.
 */
const toStepVariables = (stepId: string, detected: TWorkflowSampleVariables): TWorkflowSampleVariables => {
  const toStepPath = (path: string) => `steps.${stepId}.body.${path.replace(/^payload\./, "")}`;
  return {
    ...detected,
    variables: detected.variables.map((variable) => ({ ...variable, path: toStepPath(variable.path) })),
    notSupported: detected.notSupported.map((entry) => ({ ...entry, path: toStepPath(entry.path) })),
  };
};

/** A refused body, in fixed words: a refusal never echoes the body, which can hold customer data. */
const refuseBody = (reason: string): never => {
  if (reason === "too_large") {
    throw new WorkflowPayloadTooLargeError(
      `The expected response body is over the ${WEBHOOK_PAYLOAD_MAX_BYTES / 1024} KB limit.`
    );
  }
  if (reason === "null_byte") {
    throw new WorkflowInvalidInputError("The expected response body must not contain NULL bytes.");
  }
  throw new WorkflowInvalidInputError(
    `The expected response body must be a JSON object nested at most ${WEBHOOK_PAYLOAD_MAX_DEPTH} levels.`
  );
};

/**
 * `PUT /api/v3/workflows/{workflowId}/steps/{stepId}/expected-response` and the `set_expected_response`
 * MCP tool (ADR 0054): sets an HTTP request step's expected response body, the body its API answers with,
 * whose fields are the step's Variables and what a Test run's "Wait and use it" answers with. Stored as
 * the step's sample in a Test request response's shape (status 200, JSON), so every reader takes it
 * unchanged. The step must be an HTTP request in the draft; the body follows the expected payload's
 * limits. Write access; archived workflows are read-only. Audited with the step id, never the body.
 */
export const setWorkflowExpectedResponse = async ({
  authentication,
  requestId,
  instance,
  auditLog,
  params,
  input,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
  params: TWorkflowTestRequestParams;
  input: TSetWorkflowExpectedResponseInput;
}): Promise<Response> => {
  const ctx = buildWorkflowApiContext(authentication, requestId, instance, auditLog);
  try {
    const workflow = await loadAndAuthorize(workflowsService, ctx, params.workflowId, "readWrite");
    if (workflow instanceof Response) return workflow;
    assertNotArchived(workflow);

    const step = workflow.definition.nodes.find((node) => node.id === params.stepId);
    if (step?.type !== "action" || step.actionType !== "http_request") {
      return problemNotFound(requestId, "HTTP request step", params.stepId, instance);
    }
    const check = checkWebhookPayloadShape(input.body);
    if (!check.ok) return refuseBody(check.reason);

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
      select: { updatedAt: true },
    });

    await ctx.recordAudit?.({
      targetId: workflow.id,
      workspaceId: workflow.workspaceId,
      newObject: { expectedResponse: params.stepId },
    });

    const resource: TWorkflowExpectedResponseResource = ZWorkflowExpectedResponseResource.parse({
      workflowId: workflow.id,
      stepId: params.stepId,
      body: check.payload,
      variables: toStepVariables(params.stepId, detectWebhookVariables(check.payload)),
      updatedAt: row.updatedAt.toISOString(),
    });
    return successResponse(resource, { requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
