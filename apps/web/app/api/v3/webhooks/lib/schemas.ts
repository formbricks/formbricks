import { z } from "zod";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

/** Most surveys one webhook can name. Matches the survey picker the app offered (`WEBHOOK_SURVEYS_LIMIT`). */
export const V3_WEBHOOK_MAX_SURVEYS = 200;

export const V3_WEBHOOK_URL_MAX_LENGTH = 2048;

export const ZV3WebhookTrigger = ZWebhook.shape.triggers.element;
export const ZV3WebhookSource = ZWebhook.shape.source;

const ZV3WebhookTriggers = z.array(ZV3WebhookTrigger).min(1).max(ZV3WebhookTrigger.options.length);
const ZV3WebhookSurveyIds = z.array(z.cuid2()).max(V3_WEBHOOK_MAX_SURVEYS);
const ZV3WebhookName = z.string().trim().min(1).max(255);
const ZV3WebhookUrl = z.url().max(V3_WEBHOOK_URL_MAX_LENGTH);

export const ZV3WebhookIdParams = z.object({ webhookId: z.cuid2() }).strict();

/**
 * `workspaceId` is required on create because nothing else names the workspace. Every other operation
 * resolves it from the webhook, so it is never accepted there.
 */
export const ZV3CreateWebhookBody = z
  .object({
    workspaceId: z.cuid2(),
    name: ZV3WebhookName.optional(),
    url: ZV3WebhookUrl,
    source: ZV3WebhookSource.default("user"),
    triggers: ZV3WebhookTriggers,
    surveyIds: ZV3WebhookSurveyIds.default([]),
  })
  .strict();

/**
 * Every field is optional and a missing one is left as it is. There is no `workspaceId` and no `source`:
 * a webhook never changes workspace, and its source is set once at creation. "At least one field" is
 * enforced by the operation rather than a refinement, so the MCP schema can `.extend()` this one.
 */
export const ZV3UpdateWebhookBody = z
  .object({
    name: ZV3WebhookName.nullable().optional(),
    url: ZV3WebhookUrl.optional(),
    triggers: ZV3WebhookTriggers.optional(),
    surveyIds: ZV3WebhookSurveyIds.optional(),
  })
  .strict();

/** A webhook as the v3 API answers it. The signing secret is deliberately not part of it. */
export const ZV3WebhookResource = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().nullable(),
  url: z.string(),
  source: ZV3WebhookSource,
  triggers: z.array(ZV3WebhookTrigger),
  surveyIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** What create answers: the resource plus the signing secret, which no later response repeats. */
export const ZV3WebhookCreatedResource = ZV3WebhookResource.extend({ secret: z.string() });

/** What delete answers: only the id that is no longer addressable. */
export const ZV3WebhookIdResource = z.object({ id: z.string() });

/** The outcome of one test delivery. A failed delivery is a result, not an HTTP error. */
export const ZV3WebhookTestResult = z.object({
  delivered: z.boolean(),
  statusCode: z.number().int().nullable(),
  error: z.string().nullable(),
});

export type TV3WebhookResource = z.infer<typeof ZV3WebhookResource>;
export type TV3CreateWebhookBody = z.infer<typeof ZV3CreateWebhookBody>;
export type TV3UpdateWebhookBody = z.infer<typeof ZV3UpdateWebhookBody>;
export type TV3WebhookTestResult = z.infer<typeof ZV3WebhookTestResult>;
