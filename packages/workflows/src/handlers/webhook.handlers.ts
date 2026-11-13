import {
  type TWorkflowIdInput,
  type TWorkflowSampleResource,
  ZSetWorkflowSampleInput,
  ZWorkflowSampleResource,
  ZWorkflowWebhookResource,
} from "../contracts";
import {
  WorkflowInvalidInputError,
  WorkflowInvalidStateError,
  WorkflowPayloadTooLargeError,
  toProblemResponse,
  validateOutput,
} from "../errors";
import { dataResponse } from "../responses";
import type { WorkflowRow, WorkflowRowWithLastRun, WorkflowSampleRow } from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import { WORKFLOW_SAMPLE_TRIGGER_SOURCE } from "../types/samples";
import { WORKFLOW_TRIGGERS } from "../types/triggers/enum";
import { WEBHOOK_PAYLOAD_MAX_BYTES, WEBHOOK_PAYLOAD_MAX_DEPTH } from "../webhook/limits";
import { checkWebhookPayloadShape } from "../webhook/payload";
import { detectWebhookVariables } from "../webhook/variables";
import type { WorkflowApiContext } from "./context";
import {
  assertNotArchived,
  loadAndAuthorize,
  readJsonBody,
  recordAuditSafely,
  toAuditSnapshot,
} from "./shared";

interface WebhookResourceArgs {
  ctx: WorkflowApiContext;
  params: TWorkflowIdInput;
}
interface WebhookResourceBodyArgs extends WebhookResourceArgs {
  req: Request;
}

/** The Webhook trigger operations (ENG-7177), composed into `createWorkflowsHandlers`. */
export interface WebhookHandlers {
  getWebhook: (args: WebhookResourceArgs) => Promise<Response>;
  regenerateWebhook: (args: WebhookResourceArgs) => Promise<Response>;
  setSample: (args: WebhookResourceBodyArgs) => Promise<Response>;
}

const NO_WEBHOOK_TRIGGER = "This workflow has no Webhook trigger.";

const assertWebhookTrigger = (row: WorkflowRow): void => {
  if (row.definition.trigger?.triggerType !== WORKFLOW_TRIGGERS.WEBHOOK) {
    throw new WorkflowInvalidStateError(NO_WEBHOOK_TRIGGER);
  }
};

/**
 * The Webhook Secret URL. Built on `ctx.webhookBaseUrl` (the app's own origin, where `/api/v3` is
 * served); a missing base or token is a server fault, never something the caller can fix.
 */
const buildWebhookUrl = (ctx: WorkflowApiContext, workflowId: string, token: string | null): string => {
  if (!ctx.webhookBaseUrl || !token) {
    throw new Error("Webhook Secret URL cannot be built: missing base URL or token");
  }
  const base = ctx.webhookBaseUrl.replace(/\/+$/, "");
  return `${base}/api/v3/workflows/${encodeURIComponent(workflowId)}/webhook/${encodeURIComponent(token)}`;
};

const toSampleResource = (row: WorkflowSampleRow): TWorkflowSampleResource => ({
  workflowId: row.workflowId,
  source: WORKFLOW_SAMPLE_TRIGGER_SOURCE,
  payload: row.sample,
  variables: detectWebhookVariables(row.sample),
  updatedAt: row.updatedAt.toISOString(),
});

const webhookResponse = async (
  service: WorkflowsService,
  ctx: WorkflowApiContext,
  row: WorkflowRowWithLastRun
): Promise<Response> => {
  const sample = await service.getTriggerSample(row.id);
  const resource = validateOutput(ZWorkflowWebhookResource, {
    workflowId: row.id,
    url: buildWebhookUrl(ctx, row.id, service.revealWebhookToken(row)),
    lastCalledAt: sample?.lastCalledAt?.toISOString() ?? null,
    lastCallerIp: sample?.lastCallerIp ?? null,
    sample: sample ? toSampleResource(sample) : null,
  });
  return dataResponse(resource, ctx.requestId);
};

export const createWebhookHandlers = (service: WorkflowsService): WebhookHandlers => ({
  /**
   * The Webhook Secret URL, the last call and the Sample payload. Write access only: the URL is a
   * credential, so read-only members never see it (ADR 0041).
   */
  async getWebhook({ ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      assertWebhookTrigger(loaded);
      if (!loaded.webhookTokenEncrypted) {
        throw new WorkflowInvalidStateError(
          "This workflow has no Webhook Secret URL yet; regenerate it to create one."
        );
      }

      return await webhookResponse(service, ctx, loaded);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  /** Replaces the token: the old URL answers 404 from the next call on. */
  async regenerateWebhook({ ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      assertNotArchived(loaded);
      assertWebhookTrigger(loaded);

      const updated = await service.regenerateWebhookToken({
        workflowId: loaded.id,
        workspaceId: loaded.workspaceId,
      });

      // The snapshots are the workflow resource, which never carries token material.
      await recordAuditSafely(ctx, {
        targetId: updated.id,
        workspaceId: updated.workspaceId,
        oldObject: toAuditSnapshot(loaded, ctx.auditRedactionKey),
        newObject: toAuditSnapshot(updated, ctx.auditRedactionKey),
      });

      return await webhookResponse(service, ctx, updated);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  /** Replaces the Sample payload, e.g. with one pasted in the editor. */
  async setSample({ req, ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      assertNotArchived(loaded);
      assertWebhookTrigger(loaded);

      const input = ZSetWorkflowSampleInput.parse(await readJsonBody(req));
      const checked = checkWebhookPayloadShape(input.payload);
      if (!checked.ok) {
        // Fixed messages: a refusal never echoes the payload.
        if (checked.reason === "too_large") {
          throw new WorkflowPayloadTooLargeError(
            `The sample payload is over the ${WEBHOOK_PAYLOAD_MAX_BYTES / 1024} KB limit.`
          );
        }
        if (checked.reason === "null_byte") {
          throw new WorkflowInvalidInputError("The sample payload must not contain NULL bytes.");
        }
        throw new WorkflowInvalidInputError(
          `The sample payload must be a JSON object nested at most ${WEBHOOK_PAYLOAD_MAX_DEPTH} levels.`
        );
      }

      const sample = await service.setTriggerSample(
        { workflowId: loaded.id, workspaceId: loaded.workspaceId },
        checked.payload
      );

      return dataResponse(validateOutput(ZWorkflowSampleResource, toSampleResource(sample)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },
});
