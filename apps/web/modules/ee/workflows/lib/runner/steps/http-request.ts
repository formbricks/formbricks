import "server-only";
import { resolveBoundWorkflowSecret } from "@formbricks/workflows";
import {
  buildWorkflowHttpCall,
  capRequestRecord,
  collectSentSecretValues,
  isWorkflowHttpErrorStatus,
  summarizeWorkflowHttpResponse,
} from "../../http-request/request";
import type { WorkflowStepExecutor, WorkflowStepOutcome } from "./types";

type ExecuteInput = Parameters<WorkflowStepExecutor<"http_request">["execute"]>[0];

/**
 * "Don't wait": the delivery job reads the request from the step's row and skips a row that isn't
 * sending, and with a free worker it can start before the enqueue returns, so the row is written first
 * (ENG-7354). In a Test run nothing will send it, so the step ends with the request it would have sent.
 */
const handOffDontWaitRequest = async ({
  node,
  environment,
  effects,
  saveOutput,
  record,
}: Pick<ExecuteInput, "node" | "environment" | "effects" | "saveOutput"> & {
  record: Parameters<typeof capRequestRecord>[0];
}): Promise<WorkflowStepOutcome> => {
  if (!effects.enqueueHttpRequestDelivery) {
    return {
      status: "succeeded",
      error: null,
      output: { mode: "dont_wait", request: capRequestRecord(record) },
      variables: {},
    };
  }
  const sending = { mode: "dont_wait", delivery: "sending", request: record };
  await saveOutput(sending);
  try {
    await effects.enqueueHttpRequestDelivery({
      workflowRunId: environment.runId,
      workflowId: environment.workflowId,
      workspaceId: environment.workspaceId,
      stepId: node.id,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      error: `The HTTP request could not be handed to its sending job: ${reason}`,
      output: { mode: "dont_wait", delivery: "failed", request: capRequestRecord(record) },
      variables: {},
    };
  }
  return { status: "running", error: null, output: sending, variables: {} };
};

/**
 * Runs an HTTP request step (ENG-7168). "Wait and use it" calls through `effects.sendHttpRequest`
 * (10 s, 1 MB, 3 retries) and gives later steps `steps.<id>.status` and `steps.<id>.body`; "Don't
 * wait" stores the rendered request on the step's log row, then hands the call to its own job and
 * leaves the step `running` ("Sending…") while the run moves on; a job that can't be queued fails the
 * step at once, with the reason.
 *
 * Log row output: `mode`, `request` (secret values masked), and for a waited call the response's
 * `status`, `contentType`, `body` (≤64 KB, `bodyTruncated` when cut) and `attempts`. A "Don't wait"
 * row adds `delivery: "sending" | "sent" | "failed"` and keeps the whole rendered body until its job
 * has sent it. In a Test run (fake effects, ADR 0049) nothing is sent: "Wait and use it" gets the
 * step's last Test request response (`testSample: "used"`) or goes on with none (`"missing"`), and
 * "Don't wait" ends at once with the request it would have sent. A failed call fails the step, and
 * so the run, unless "Continue on error" is on; the queue never sends it again (`failsForGood`), since
 * the retries are the step's own and a call that timed out may still have arrived. A stored secret value is attached only when the step's
 * URL is on the origin it was set for (ADR 0051); otherwise nothing is sent and the step fails naming
 * the header and that host, which "Continue on error" also lets the run go past.
 */
export const httpRequestStepExecutor: WorkflowStepExecutor<"http_request"> = {
  hasEffects: true,
  failsForGood: true,
  describeInput: (node) => ({
    method: node.config.method,
    url: node.config.url,
    responseMode: node.config.responseMode,
  }),
  execute: async ({ node, context, environment, effects, saveOutput }): Promise<WorkflowStepOutcome> => {
    const { config } = node;
    const built = buildWorkflowHttpCall(config, context, (header) => {
      const resolved = resolveBoundWorkflowSecret({
        headerName: header.name,
        secret: header.secretId ? environment.secretValues.get(header.secretId) : undefined,
        requestUrl: config.url,
        savedUrl: config.url,
      });
      return resolved && "value" in resolved ? resolved.value : resolved;
    });
    if (!built.ok) {
      const mode = config.responseMode;
      return built.secretRefused && config.continueOnError
        ? { status: "succeeded", error: null, output: { mode, error: built.error }, variables: {} }
        : { status: "failed", error: built.error, output: { mode } };
    }

    if (config.responseMode === "dont_wait") {
      return handOffDontWaitRequest({ node, environment, effects, saveOutput, record: built.record });
    }

    const result = await effects.sendHttpRequest(built.call, { stepId: node.id });
    const request = capRequestRecord(built.record);
    if (result.testSample === "missing") {
      // A Test run of a step that has no Test request response yet: later steps see no response.
      return {
        status: "succeeded",
        error: null,
        output: { mode: "wait", request, testSample: "missing" },
        variables: {},
      };
    }
    const testSample = result.testSample ? { testSample: result.testSample } : {};
    if (!result.response) {
      const output = { mode: "wait", request, attempts: result.attempts };
      return config.continueOnError
        ? { status: "succeeded", error: null, output: { ...output, error: result.error }, variables: {} }
        : { status: "failed", error: result.error, output };
    }

    const { variables, record } = summarizeWorkflowHttpResponse(
      result.response,
      collectSentSecretValues(built.call, built.record)
    );
    const output = { mode: "wait", request, ...record, attempts: result.attempts, ...testSample };
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
  // A "Don't wait" response never reaches later steps, even when its job recorded one.
  variablesFromOutput: (output) =>
    output.mode === "dont_wait"
      ? {}
      : {
          ...(output.status === undefined ? {} : { status: output.status }),
          ...(output.body === undefined ? {} : { body: output.body }),
        },
  handedOff: (output) => output.mode === "dont_wait",
};
