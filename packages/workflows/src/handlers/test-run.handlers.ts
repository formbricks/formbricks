import {
  type TCreateWorkflowTestRunInput,
  type TWorkflowIdInput,
  ZCreateWorkflowTestRunInput,
  ZWorkflowRunResource,
} from "../contracts";
import {
  WorkflowForbiddenError,
  WorkflowInvalidInputError,
  WorkflowInvalidStateError,
  WorkflowNotExecutableError,
  WorkflowPayloadTooLargeError,
  toProblemResponse,
  validateOutput,
} from "../errors";
import { createdResponse } from "../responses";
import type { WorkflowRowWithLastRun } from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import { ZWorkflowEnableDefinition } from "../types/document";
import type { TWorkflowTriggerRunPayload } from "../types/runs";
import { WORKFLOW_TRIGGERS } from "../types/triggers/enum";
import type { TWorkflowWebhookPayload } from "../types/triggers/webhook";
import { WEBHOOK_PAYLOAD_MAX_BYTES, WEBHOOK_PAYLOAD_MAX_DEPTH } from "../webhook/limits";
import { checkWebhookPayloadShape } from "../webhook/payload";
import type { WorkflowApiContext } from "./context";
import { toWorkflowRunResource } from "./serializers";
import { loadAndAuthorize, readJsonBody, recordAuditSafely } from "./shared";

interface TestRunArgs {
  req: Request;
  ctx: WorkflowApiContext;
  params: TWorkflowIdInput;
}

/** The Test run operation (ENG-7181), composed into `createWorkflowsHandlers`. */
export interface TestRunHandlers {
  createTestRun: (args: TestRunArgs) => Promise<Response>;
}

/** The body's payload checked against the Secret URL's limits; fixed messages never echo it. */
const checkPayload = (payload: TWorkflowWebhookPayload): TWorkflowWebhookPayload => {
  const checked = checkWebhookPayloadShape(payload);
  if (checked.ok) return checked.payload;
  if (checked.reason === "too_large") {
    throw new WorkflowPayloadTooLargeError(
      `The test payload is over the ${WEBHOOK_PAYLOAD_MAX_BYTES / 1024} KB limit.`
    );
  }
  if (checked.reason === "null_byte") {
    throw new WorkflowInvalidInputError("The test payload must not contain NULL bytes.");
  }
  throw new WorkflowInvalidInputError(
    `The test payload must be a JSON object nested at most ${WEBHOOK_PAYLOAD_MAX_DEPTH} levels.`
  );
};

/** The Webhook trigger's run payload: the body's payload, else the workflow's Sample payload. */
const buildWebhookTriggerPayload = async (
  service: WorkflowsService,
  loaded: WorkflowRowWithLastRun,
  input: TCreateWorkflowTestRunInput
): Promise<TWorkflowTriggerRunPayload> => {
  if (input.responseId) {
    throw new WorkflowInvalidInputError(
      "`responseId` is for Response completed workflows; a Webhook workflow tests with `payload`."
    );
  }
  const payload = input.payload
    ? checkPayload(input.payload)
    : (await service.getTriggerSample(loaded.id))?.sample;
  if (!payload) {
    throw new WorkflowInvalidStateError(
      "No test payload: send a payload or set the workflow's Sample payload first."
    );
  }
  return {
    type: WORKFLOW_TRIGGERS.WEBHOOK,
    workspaceId: loaded.workspaceId,
    payload,
    triggeredAt: new Date().toISOString(),
  };
};

/**
 * The Response completed trigger's run payload, built from an existing response the way a real run
 * builds it (ADR 0049). The response must belong to the trigger's survey in this workspace; the
 * adapter's lookup answers null otherwise, which is refused like an unknown id. Its ending is not
 * checked against the trigger's endings, nor whether it finished: testing a response the trigger
 * would skip is allowed, and the editor says so.
 */
const buildResponseCompletedTriggerPayload = async (
  ctx: WorkflowApiContext,
  loaded: WorkflowRowWithLastRun,
  surveyId: string,
  input: TCreateWorkflowTestRunInput
): Promise<TWorkflowTriggerRunPayload> => {
  if (input.payload) {
    throw new WorkflowInvalidInputError(
      "`payload` is for Webhook workflows; a Response completed workflow tests with `responseId`."
    );
  }
  if (!input.responseId) {
    throw new WorkflowInvalidInputError(
      "A Response completed workflow tests with an existing response: send its `responseId`."
    );
  }
  if (!ctx.loadTestRunResponse) {
    throw new Error("Response Test runs are not available: no response lookup was injected");
  }
  const response = await ctx.loadTestRunResponse({
    workspaceId: loaded.workspaceId,
    surveyId,
    responseId: input.responseId,
  });
  if (!response) {
    throw new WorkflowForbiddenError(
      "That response is not a response of this workflow's survey, or you cannot access it."
    );
  }
  return {
    type: WORKFLOW_TRIGGERS.RESPONSE_COMPLETED,
    workspaceId: loaded.workspaceId,
    surveyId: response.surveyId,
    responseId: response.id,
    ...(response.endingId ? { endingCardId: response.endingId } : {}),
    data: response.data,
    triggeredAt: new Date().toISOString(),
  };
};

export const createTestRunHandlers = (service: WorkflowsService): TestRunHandlers => ({
  /**
   * `POST /workflows/{id}/test-runs` and MCP `run_test` (ADR 0049): runs the workflow's current draft
   * at once with fake effects, through the adapter's `ctx.runTest`, and answers with the run. Write
   * access, like the editor that owns the draft. The run is saved with `isDryRun = true` and no
   * version, so usage counts and billing skip it. A Webhook trigger tests with a payload, a Response
   * completed trigger with an existing response of its survey.
   */
  async createTestRun({ req, ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      if (loaded.status === "archived") {
        throw new WorkflowInvalidStateError("Archived workflows cannot be tested; unarchive first.");
      }
      const triggerType = loaded.definition.trigger?.triggerType;
      if (triggerType !== WORKFLOW_TRIGGERS.WEBHOOK && triggerType !== WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) {
        throw new WorkflowInvalidStateError("A Test run needs a Webhook or Response completed trigger.");
      }
      if (!ctx.runTest) throw new Error("Test runs are not available: no runner was injected");

      const input = ZCreateWorkflowTestRunInput.parse(await readJsonBody(req, { allowEmpty: true }));

      const executable = ZWorkflowEnableDefinition.safeParse(loaded.definition);
      if (!executable.success) throw WorkflowNotExecutableError.fromZodError(executable.error);

      const { trigger } = executable.data;
      const triggerPayload =
        trigger.triggerType === WORKFLOW_TRIGGERS.RESPONSE_COMPLETED
          ? await buildResponseCompletedTriggerPayload(ctx, loaded, trigger.config.surveyId, input)
          : await buildWebhookTriggerPayload(service, loaded, input);

      const scope = { workflowId: loaded.id, workspaceId: loaded.workspaceId };
      const created = await service.createTestRun(scope, { triggerPayload, definition: executable.data });
      await ctx.runTest({ runId: created.id, ...scope });

      const run = await service.getWorkflowRun(created.id);
      if (!run) throw new Error(`Test run ${created.id} disappeared after it ran`);

      // The run id and outcome only: the payload is caller data and stays out of the audit log.
      await recordAuditSafely(ctx, {
        targetId: loaded.id,
        workspaceId: loaded.workspaceId,
        newObject: { runId: run.id, status: run.status },
      });

      return createdResponse(
        validateOutput(ZWorkflowRunResource, toWorkflowRunResource(run)),
        `/api/v3/workflows/runs/${run.id}`,
        ctx.requestId
      );
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },
});
