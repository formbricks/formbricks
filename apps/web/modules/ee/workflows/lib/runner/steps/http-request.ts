import "server-only";
import {
  buildWorkflowHttpCall,
  capRequestRecord,
  isWorkflowHttpErrorStatus,
  summarizeWorkflowHttpResponse,
} from "../../http-request/request";
import type { WorkflowStepExecutor, WorkflowStepOutcome } from "./types";

/**
 * Runs an HTTP request step (ENG-7168). "Wait and use it" calls through `effects.sendHttpRequest`
 * (10 s, 1 MB, 3 retries) and gives later steps `steps.<id>.status` and `steps.<id>.body`; "Don't
 * wait" stores the rendered request on the step's log row, hands the call to its own job and leaves
 * the step `running` ("Sending…") while the run moves on.
 *
 * Log row output: `mode`, `request` (secret values masked), and for a waited call the response's
 * `status`, `contentType`, `body` (≤64 KB, `bodyTruncated` when cut) and `attempts`. A "Don't wait"
 * row adds `delivery: "sending" | "sent" | "failed"` and keeps the whole rendered body until its job
 * has sent it. A failed call fails the step, and so the run, unless "Continue on error" is on.
 */
export const httpRequestStepExecutor: WorkflowStepExecutor<"http_request"> = {
  hasEffects: true,
  describeInput: (node) => ({
    method: node.config.method,
    url: node.config.url,
    responseMode: node.config.responseMode,
  }),
  execute: async ({ node, context, environment, effects }): Promise<WorkflowStepOutcome> => {
    const { config } = node;
    const built = buildWorkflowHttpCall(config, context, (header) =>
      header.secretId ? environment.secretValues.get(header.secretId) : undefined
    );
    if (!built.ok) return { status: "failed", error: built.error, output: { mode: config.responseMode } };

    if (config.responseMode === "dont_wait") {
      await effects.enqueueHttpRequestDelivery({
        workflowRunId: environment.runId,
        workflowId: environment.workflowId,
        workspaceId: environment.workspaceId,
        stepId: node.id,
      });
      return {
        status: "running",
        error: null,
        output: { mode: "dont_wait", delivery: "sending", request: built.record },
        variables: {},
      };
    }

    const result = await effects.sendHttpRequest(built.call);
    const request = capRequestRecord(built.record);
    if (!result.response) {
      const output = { mode: "wait", request, attempts: result.attempts };
      return config.continueOnError
        ? { status: "succeeded", error: null, output: { ...output, error: result.error }, variables: {} }
        : { status: "failed", error: result.error, output };
    }

    const { variables, record } = summarizeWorkflowHttpResponse(result.response);
    const output = { mode: "wait", request, ...record, attempts: result.attempts };
    if (isWorkflowHttpErrorStatus(result.response.status) && !config.continueOnError) {
      return {
        status: "failed",
        error: `The HTTP request was answered with status ${result.response.status.toString()}`,
        output,
        variables,
      };
    }
    return { status: "succeeded", error: null, output, variables };
  },
  variablesFromOutput: (output) => ({
    ...(output.status === undefined ? {} : { status: output.status }),
    ...(output.body === undefined ? {} : { body: output.body }),
  }),
  handedOff: (output) => output.mode === "dont_wait",
};
