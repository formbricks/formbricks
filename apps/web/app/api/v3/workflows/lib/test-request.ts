import "server-only";
import { prisma } from "@formbricks/database";
import {
  type TSendWorkflowTestRequestInput,
  type TWorkflowDefinition,
  type TWorkflowHttpRequestActionNode,
  type TWorkflowRunContext,
  type TWorkflowTestRequestParams,
  type TWorkflowTestRequestResult,
  WORKFLOW_SAMPLE_TRIGGER_SOURCE,
  ZWorkflowHttpRequestActionConfig,
  getLastTestSampleSource,
  isDefaultSecretHeaderName,
  resolveBoundWorkflowSecret,
} from "@formbricks/workflows";
import {
  WorkflowForbiddenError,
  WorkflowInvalidInputError,
  WorkflowInvalidStateError,
  toProblemResponse,
} from "@formbricks/workflows/server";
import { applyV3OperationRateLimit } from "@/app/api/v3/lib/operation-rate-limit";
import { problemNotFound, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  type TWorkflowSecretResolver,
  buildWorkflowHttpCall,
  capRequestRecord,
  collectSentSecretValues,
  summarizeWorkflowHttpResponse,
} from "@/modules/ee/workflows/lib/http-request/request";
import { sendWorkflowHttpRequest } from "@/modules/ee/workflows/lib/http-request/send-http-request";
import { loadWorkflowSecretValues } from "@/modules/ee/workflows/lib/secret-headers/workflow-secret-store";
import { buildWorkflowApiContext } from "./context";

const isHttpRequestNode = (
  node: TWorkflowDefinition["nodes"][number]
): node is TWorkflowHttpRequestActionNode => node.type === "action" && node.actionType === "http_request";

const urlHost = (url: string): string | null => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

/**
 * The Variables a Test request renders with: the given test payload, else the workflow's Sample
 * payload; the given step outputs, else each other HTTP request step's expected response body.
 * One query for all samples.
 */
const loadTestContext = async (
  workflowId: string,
  definition: TWorkflowDefinition,
  stepId: string,
  variables: TSendWorkflowTestRequestInput["variables"]
): Promise<TWorkflowRunContext> => {
  const otherHttpStepIds = definition.nodes
    .filter((node) => isHttpRequestNode(node) && node.id !== stepId)
    .map((node) => node.id);
  const sources = [
    ...(variables?.payload ? [] : [WORKFLOW_SAMPLE_TRIGGER_SOURCE]),
    ...(variables?.steps ? [] : otherHttpStepIds),
  ];
  const samples =
    sources.length === 0
      ? []
      : await prisma.workflowSample.findMany({
          where: { workflowId, source: { in: sources } },
          select: { source: true, sample: true },
        });
  const bySource = new Map(samples.map((sample) => [sample.source, sample.sample]));

  const steps: TWorkflowRunContext["steps"] = variables?.steps ?? {};
  if (!variables?.steps) {
    for (const id of otherHttpStepIds) {
      const sample = bySource.get(id);
      if (sample) steps[id] = { status: sample.status, body: sample.body };
    }
  }
  const payload = variables?.payload ?? bySource.get(WORKFLOW_SAMPLE_TRIGGER_SOURCE);
  return { steps, ...(payload ? { payload } : {}) };
};

/**
 * Secret header values for a call to `requestUrl`: a value typed in the draft is used once and never
 * stored, and goes wherever the draft points, since it is the caller's own. A secret without one uses
 * the saved secret of the same step and name, but only on the origin that value was set for (ADR 0051):
 * a draft URL elsewhere could otherwise carry the workflow's stored credential to any server, which is
 * the step an agent obeying hostile text in a payload or API response would take. Secret ids come only
 * from the saved definition, never from the request (ADR 0043).
 */
const buildSecretResolver = async (
  workflow: { id: string; workspaceId: string },
  savedNode: TWorkflowHttpRequestActionNode,
  requestUrl: string
): Promise<TWorkflowSecretResolver> => {
  const savedIds = new Map(
    savedNode.config.headers
      .filter((header) => header.secret === true && header.secretId)
      .map((header) => [header.name.toLowerCase(), header.secretId as string])
  );
  const values = await loadWorkflowSecretValues({
    workflowId: workflow.id,
    workspaceId: workflow.workspaceId,
    secretIds: [...savedIds.values()],
  });
  return (header) => {
    if (header.value !== undefined && header.value !== "") return header.value;
    const secretId = savedIds.get(header.name.toLowerCase());
    const resolved = resolveBoundWorkflowSecret({
      headerName: header.name,
      secret: secretId ? values.get(secretId) : undefined,
      requestUrl,
      savedUrl: savedNode.config.url,
    });
    return resolved && "value" in resolved ? resolved.value : resolved;
  };
};

/**
 * `POST /api/v3/workflows/{workflowId}/steps/{stepId}/test-request` and the MCP `send_test_request`
 * tool (ENG-7179, ENG-7168): one real call of an HTTP request step from its saved or draft settings.
 * Write access, 30 per minute per user or API key, the same address checks and secret host binding
 * as a run (a stored secret set for another host is a 400), 10 s and no retry. Not a run and not billed. An answer is kept as the step's last Test request response (≤64 KB, ADR 0054) and the call is
 * audited (`testRequestSent`) with its host and status, never its headers or body.
 */
export const sendWorkflowTestRequest = async ({
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
  /** `config` is parsed here with the shared schema, whichever surface (REST or MCP) read it. */
  input: { config?: unknown; variables?: TSendWorkflowTestRequestInput["variables"] };
}): Promise<Response> => {
  const limited = await applyV3OperationRateLimit({
    config: rateLimitConfigs.api.v3WorkflowTestRequests,
    authentication,
    requestId,
    instance,
  });
  if (limited) return limited;

  const ctx = buildWorkflowApiContext(authentication, requestId, instance, auditLog);
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
      select: { id: true, workspaceId: true, status: true, definition: true },
    });
    // Unknown and foreign workflows answer alike, as every workflow operation does.
    if (!workflow) throw new WorkflowForbiddenError();
    const authorized = await ctx.authorize(workflow.workspaceId, "readWrite");
    if (authorized instanceof Response) return authorized;
    if (workflow.status === "archived") {
      throw new WorkflowInvalidStateError("Archived workflows are read-only; unarchive before editing.");
    }

    const definition: TWorkflowDefinition = workflow.definition;
    const savedNode = definition.nodes.find((node) => node.id === params.stepId);
    if (!savedNode || !isHttpRequestNode(savedNode)) {
      return problemNotFound(requestId, "HTTP request step", params.stepId, instance);
    }

    // Parsed again here: the MCP tool's input schema is its own, and this applies the shared rules.
    const draftConfig = input.config
      ? ZWorkflowHttpRequestActionConfig.parse(input.config)
      : savedNode.config;
    // A credential-looking header typed without `secret` is masked like a secret in what comes back.
    const config = {
      ...draftConfig,
      headers: draftConfig.headers.map((header) => ({
        ...header,
        secret: header.secret ?? isDefaultSecretHeaderName(header.name),
      })),
    };
    const [context, resolveSecret] = await Promise.all([
      loadTestContext(workflow.id, definition, params.stepId, input.variables),
      buildSecretResolver(workflow, savedNode, config.url),
    ]);
    const built = buildWorkflowHttpCall(config, context, resolveSecret);
    if (!built.ok) throw new WorkflowInvalidInputError(built.error);

    const outcome = await sendWorkflowHttpRequest(built.call, { retries: 0 });
    const response = outcome.response
      ? summarizeWorkflowHttpResponse(outcome.response, collectSentSecretValues(built.call, built.record))
          .record
      : null;
    // Kept as the step's last Test request response, never as its expected response body, which only
    // editors set (ADR 0054): the editor offers it, and the Variables stay put until one is chosen.
    if (response) {
      const source = getLastTestSampleSource(params.stepId);
      await prisma.workflowSample.upsert({
        where: { workflowId_source: { workflowId: workflow.id, source } },
        create: {
          workflowId: workflow.id,
          workspaceId: workflow.workspaceId,
          source,
          sample: { ...response },
        },
        update: { sample: { ...response } },
      });
    }

    await ctx.recordAudit?.({
      targetId: workflow.id,
      workspaceId: workflow.workspaceId,
      newObject: {
        stepId: params.stepId,
        host: urlHost(built.call.url),
        status: response?.status ?? null,
      },
    });

    const result: TWorkflowTestRequestResult = {
      request: capRequestRecord(built.record),
      response,
      error: outcome.error,
    };
    return successResponse(result, { requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
