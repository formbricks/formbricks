import { type TWorkflowIdInput, ZCreateWorkflowTestRunInput, ZWorkflowRunResource } from "../contracts";
import {
  WorkflowInvalidInputError,
  WorkflowInvalidStateError,
  WorkflowNotExecutableError,
  WorkflowPayloadTooLargeError,
  toProblemResponse,
  validateOutput,
} from "../errors";
import { createdResponse } from "../responses";
import type { WorkflowsService } from "../services/workflows.service";
import { ZWorkflowExecutableDefinition } from "../types/document";
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
  throw new WorkflowInvalidInputError(
    `The test payload must be a JSON object nested at most ${WEBHOOK_PAYLOAD_MAX_DEPTH} levels.`
  );
};

export const createTestRunHandlers = (service: WorkflowsService): TestRunHandlers => ({
  /**
   * `POST /workflows/{id}/test-runs` and MCP `run_test` (ADR 0049): runs the workflow's current draft
   * at once with fake effects, through the adapter's `ctx.runTest`, and answers with the run. Write
   * access, like the editor that owns the draft. The run is saved with `isDryRun = true` and no
   * version, so usage counts and billing skip it. Only a Webhook trigger has a payload to test with.
   */
  async createTestRun({ req, ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      if (loaded.status === "archived") {
        throw new WorkflowInvalidStateError("Archived workflows cannot be tested; unarchive first.");
      }
      if (loaded.definition.trigger?.triggerType !== WORKFLOW_TRIGGERS.WEBHOOK) {
        throw new WorkflowInvalidStateError("A Test run needs a Webhook trigger.");
      }
      if (!ctx.runTest) throw new Error("Test runs are not available: no runner was injected");

      const input = ZCreateWorkflowTestRunInput.parse(await readJsonBody(req, { allowEmpty: true }));

      const executable = ZWorkflowExecutableDefinition.safeParse(loaded.definition);
      if (!executable.success) throw WorkflowNotExecutableError.fromZodError(executable.error);

      const payload = input.payload
        ? checkPayload(input.payload)
        : (await service.getTriggerSample(loaded.id))?.sample;
      if (!payload) {
        throw new WorkflowInvalidStateError(
          "No test payload: send a payload or set the workflow's Sample payload first."
        );
      }

      const scope = { workflowId: loaded.id, workspaceId: loaded.workspaceId };
      const triggerPayload: TWorkflowTriggerRunPayload = {
        type: WORKFLOW_TRIGGERS.WEBHOOK,
        workspaceId: loaded.workspaceId,
        payload,
        triggeredAt: new Date().toISOString(),
      };
      const created = await service.createTestRun(scope, triggerPayload);
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
