import { z } from "zod";
import { ZResponse } from "@formbricks/types/responses";
import { ZSurveyStatus, ZSurveyType } from "@formbricks/types/surveys/types";
import { ZTag } from "@formbricks/types/tags";
import { ZUserLocale } from "@formbricks/types/user";

export const ZTestLogJobData = z.object({
  message: z.string().min(1),
  shouldFail: z.boolean().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type TTestLogJobData = z.infer<typeof ZTestLogJobData>;

export const ZResponsePipelineEvent = z.enum(["responseFinished", "responseCreated", "responseUpdated"]);

export type TResponsePipelineEvent = z.infer<typeof ZResponsePipelineEvent>;

const ZResponsePipelineJobTag = ZTag.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Exported because the webhook-delivery payload carries the same point-in-time response snapshot.
export const ZResponsePipelineJobResponse = ZResponse.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  tags: z.array(ZResponsePipelineJobTag),
});

export const ZResponsePipelineJobData = z.object({
  event: ZResponsePipelineEvent,
  response: ZResponsePipelineJobResponse,
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  // Respondent's resolved locale, captured in request scope (headers() is unavailable in the worker).
  // Used to localize follow-up email chrome; falls back to DEFAULT_LOCALE when absent.
  locale: ZUserLocale.optional(),
});

export type TResponsePipelineJobData = z.infer<typeof ZResponsePipelineJobData>;

/**
 * Payload shared by every recurring job: each one is a single global sweep, so it carries no
 * identifiers. A future per-tenant recurring job needs its own schema — and a handler that scopes its
 * queries by that tenant, resolved from the database rather than trusted from the job data — instead of
 * widening this literal.
 */
export const ZGlobalScopeJobData = z.object({
  scope: z.literal("global"),
});

export type TGlobalScopeJobData = z.infer<typeof ZGlobalScopeJobData>;

// Per-job aliases: the app's handlers are typed with these, and the names document which job a payload
// belongs to even though the three shapes are identical today.
export const ZSurveySchedulingJobData = ZGlobalScopeJobData;

export type TSurveySchedulingJobData = TGlobalScopeJobData;

export const ZSurveyArchivePurgeJobData = ZGlobalScopeJobData;

export type TSurveyArchivePurgeJobData = TGlobalScopeJobData;

export const ZUsageTelemetryJobData = ZGlobalScopeJobData;

export type TUsageTelemetryJobData = TGlobalScopeJobData;

/** Daily PostHog snapshot of workflow usage per organization (ENG-2851). */
export const ZWorkflowsUsageSnapshotJobData = ZGlobalScopeJobData;
export type TWorkflowsUsageSnapshotJobData = TGlobalScopeJobData;

export const ZWorkflowRunJobData = z.object({
  workflowRunId: z.cuid2(),
  workflowId: z.cuid2(),
  workspaceId: z.cuid2(),
});

export type TWorkflowRunJobData = z.infer<typeof ZWorkflowRunJobData>;

// The reconciler is a global periodic sweep, not a per-run job — it carries no run identifiers.
export const ZWorkflowRunReconcileJobData = ZGlobalScopeJobData;

export type TWorkflowRunReconcileJobData = TGlobalScopeJobData;

/**
 * One webhook delivery, fanned out by the response pipeline job — one job per matching webhook, so each
 * endpoint retries on its own budget without re-sending to the others or holding up the pipeline's
 * remaining side effects.
 *
 * The payload is the snapshot the pipeline job held when the event fired (response + the survey fields
 * the body exposes); the webhook's `url` and `secret` are deliberately NOT here — the handler re-reads
 * them from the database at delivery time, so the signing secret never sits in Redis and a webhook
 * deleted or re-scoped while retries are pending is skipped.
 *
 * `response` deliberately goes the other way. Re-reading it would cost a query per attempt and, more
 * importantly, would deliver whatever the response says *now* rather than what it said when the event
 * fired — the point-in-time semantics the pre-fan-out body had. The price is one copy of the snapshot per
 * matching webhook in Redis (plus the pipeline job's own), held for the queue's completed and failed
 * retention, so a survey with many webhooks and long free-text answers multiplies its footprint by the
 * webhook count. ENG-2318 tracks the payload size generally.
 *
 * `webhookMessageId` is the Standard Webhooks `webhook-id`. The pipeline job derives it from its own job
 * id (the same derivation as before the fan-out), so receivers see identical ids and it stays constant
 * across every retry of this job.
 */
export const ZWebhookDeliveryJobData = z.object({
  webhookId: z.cuid2(),
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  event: ZResponsePipelineEvent,
  webhookMessageId: z.string().regex(/^[0-9a-f]{64}$/, "webhookMessageId must be a sha256 hex digest"),
  response: ZResponsePipelineJobResponse,
  survey: z.object({
    name: z.string(),
    type: ZSurveyType,
    status: ZSurveyStatus,
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
});

export type TWebhookDeliveryJobData = z.infer<typeof ZWebhookDeliveryJobData>;
