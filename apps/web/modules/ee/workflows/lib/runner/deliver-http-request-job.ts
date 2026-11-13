import "server-only";
import { prisma } from "@formbricks/database";
import type { JobHandler, TWorkflowHttpRequestDeliveryJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import {
  type TWorkflowHttpRequestActionNode,
  WORKFLOW_SECRET_MASK,
  ZWorkflowHttpRequestActionNode,
} from "@formbricks/workflows";
import {
  type TWorkflowHttpRequestRecord,
  capRequestRecord,
  collectSentSecretValues,
  isWorkflowHttpErrorStatus,
  summarizeWorkflowHttpResponse,
} from "../http-request/request";
import {
  WORKFLOW_HTTP_RETRIES,
  type WorkflowHttpCall,
  type WorkflowHttpCallResult,
  sendWorkflowHttpRequest,
} from "../http-request/send-http-request";
import { loadWorkflowSecretValues } from "../secret-headers/workflow-secret-store";

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const isRequestRecord = (value: unknown): value is TWorkflowHttpRequestRecord => {
  const record = toRecord(value);
  return typeof record.method === "string" && typeof record.url === "string" && Array.isArray(record.headers);
};

/** The step's node in the definition the run executed (its version, else the live one). */
const findHttpRequestNode = (definition: unknown, stepId: string): TWorkflowHttpRequestActionNode | null => {
  const nodes = toRecord(definition).nodes;
  if (!Array.isArray(nodes)) return null;
  const parsed = ZWorkflowHttpRequestActionNode.safeParse(nodes.find((node) => toRecord(node).id === stepId));
  return parsed.success ? parsed.data : null;
};

/**
 * Rebuilds the call from the stored (masked) request: each masked header of a secret takes its value
 * from the workflow's secret row as it is now, so a Replace done in between is already used (ADR 0043).
 */
const rebuildCall = (
  request: TWorkflowHttpRequestRecord,
  node: TWorkflowHttpRequestActionNode,
  secretValues: ReadonlyMap<string, string>
): { call: WorkflowHttpCall } | { error: string } => {
  const secretIdsByName = new Map(
    node.config.headers
      .filter((header) => header.secret === true)
      .map((header) => [header.name.toLowerCase(), header.secretId])
  );
  const headers: Record<string, string> = {};
  for (const header of request.headers) {
    const isSecret = secretIdsByName.has(header.name.toLowerCase()) && header.value === WORKFLOW_SECRET_MASK;
    if (!isSecret) {
      headers[header.name] = header.value;
      continue;
    }
    const secretId = secretIdsByName.get(header.name.toLowerCase());
    const value = secretId ? secretValues.get(secretId) : undefined;
    if (value === undefined) return { error: `Secret header ${header.name} has no value; enter it again` };
    headers[header.name] = value;
  }
  return {
    call: {
      method: request.method,
      url: request.url,
      headers,
      ...(request.body === undefined ? {} : { body: request.body }),
    },
  };
};

/** The step's final row: what run detail shows for a "Don't wait" call. The request body is capped now. */
const finalOutput = (
  request: TWorkflowHttpRequestRecord,
  result: WorkflowHttpCallResult | null,
  sentSecretValues: readonly string[]
) => {
  const delivered = result?.response && !isWorkflowHttpErrorStatus(result.response.status);
  return {
    mode: "dont_wait",
    delivery: delivered ? "sent" : "failed",
    request: capRequestRecord(request),
    ...(result?.response ? summarizeWorkflowHttpResponse(result.response, sentSecretValues).record : {}),
    ...(result ? { attempts: result.attempts } : {}),
  };
};

const failureMessage = (result: WorkflowHttpCallResult): string | null => {
  if (!result.response) return result.error ?? "The request could not be sent";
  if (isWorkflowHttpErrorStatus(result.response.status)) {
    return `The HTTP request was answered with status ${result.response.status.toString()}`;
  }
  return null;
};

/**
 * Handler for `workflow-http-request.deliver`: one HTTP request step set to "Don't wait" (ENG-7179,
 * ADR 0047). The run has already moved on; this job sends the request its step stored, with the same
 * checks and 3 retries as a waiting step, and records the outcome on the step's log row only. A
 * failure shows on the step and never fails the run.
 *
 * At most once: only a row still `running` with `delivery: "sending"` is sent, and the final write is
 * guarded on `running`, so a redelivered job or a row the hourly cleanup already failed is left alone.
 * Tenant-scoped by the job's workspace.
 */
export const createWorkflowHttpRequestDeliveryJobHandler =
  ({
    send = (call) => sendWorkflowHttpRequest(call, { retries: WORKFLOW_HTTP_RETRIES }),
  }: {
    send?: (call: WorkflowHttpCall) => Promise<WorkflowHttpCallResult>;
  } = {}): JobHandler<TWorkflowHttpRequestDeliveryJobData> =>
  async (data, context) => {
    const logContext = {
      jobId: context.jobId,
      workflowRunId: data.workflowRunId,
      workflowId: data.workflowId,
      workspaceId: data.workspaceId,
      stepId: data.stepId,
    };

    const run = await prisma.workflowRun.findFirst({
      where: { id: data.workflowRunId, workspaceId: data.workspaceId },
      select: {
        workflowId: true,
        workflowVersion: { select: { definition: true } },
        workflow: { select: { definition: true } },
      },
    });
    if (!run) {
      logger.error(logContext, "Workflow run for HTTP request delivery not found; dropping job");
      return;
    }

    const row = await prisma.workflowRunLog.findFirst({
      where: { runId: data.workflowRunId, stepId: data.stepId },
      select: { status: true, output: true },
    });
    const output = toRecord(row?.output);
    if (row?.status !== "running" || output.delivery !== "sending" || !isRequestRecord(output.request)) {
      logger.info(logContext, "Workflow HTTP request is no longer sending; skipping delivery");
      return;
    }
    const request = output.request;

    const finish = async (
      status: "succeeded" | "failed",
      error: string | null,
      result: WorkflowHttpCallResult | null,
      sentSecretValues: readonly string[] = []
    ) => {
      const written = await prisma.workflowRunLog.updateMany({
        where: { runId: data.workflowRunId, stepId: data.stepId, status: "running" },
        data: {
          status,
          error,
          output: finalOutput(request, result, sentSecretValues),
          finishedAt: new Date(),
        },
      });
      if (written.count === 0) logger.info(logContext, "Workflow HTTP request step was finalized elsewhere");
    };

    const node = findHttpRequestNode(run.workflowVersion?.definition ?? run.workflow.definition, data.stepId);
    if (!node) {
      await finish("failed", "The HTTP request step no longer exists", null);
      return;
    }
    const secretIds = node.config.headers.flatMap((header) =>
      header.secret === true && header.secretId ? [header.secretId] : []
    );
    const secretValues = await loadWorkflowSecretValues({
      workflowId: run.workflowId,
      workspaceId: data.workspaceId,
      secretIds,
    });
    const rebuilt = rebuildCall(request, node, secretValues);
    if ("error" in rebuilt) {
      await finish("failed", rebuilt.error, null);
      return;
    }

    const result = await send(rebuilt.call);
    const error = failureMessage(result);
    await finish(
      error ? "failed" : "succeeded",
      error,
      result,
      collectSentSecretValues(rebuilt.call, request)
    );
    if (error)
      logger.warn({ ...logContext, attempts: result.attempts }, "Workflow HTTP request delivery failed");
  };

export const processWorkflowHttpRequestDeliveryJob = createWorkflowHttpRequestDeliveryJobHandler();
