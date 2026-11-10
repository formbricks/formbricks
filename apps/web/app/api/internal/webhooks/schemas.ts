import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZWebhookInput } from "@/modules/integrations/webhooks/types/webhooks";

/** Caps on what a webhook write carries (CODING_STANDARDS.md "Input Limits"); `surveyIds` has the v3 array cap. */
export const WEBHOOK_NAME_MAX = 255;
export const WEBHOOK_URL_MAX = 4096;
/** A signing secret this API generated (`whsec_` and 44 base64 characters), echoed back by the add modal. */
export const WEBHOOK_SECRET_MAX = 1024;

/** `?workspaceId=` on the collection's writes. */
export const ZWebhookWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

/** `/api/internal/webhooks/{webhookId}` path. */
export const ZWebhookIdParams = z.object({ webhookId: ZId }).strict();

/** A webhook's settings as the add and settings forms send them: `ZWebhookInput`, bounded and strict. */
const ZWebhookSettings = ZWebhookInput.extend({
  name: ZWebhookInput.shape.name.unwrap().unwrap().max(WEBHOOK_NAME_MAX).nullable().optional(),
  url: ZWebhookInput.shape.url.max(WEBHOOK_URL_MAX),
}).strict();

/**
 * `POST /api/internal/webhooks?workspaceId=`: a new webhook. `secret` is the one the endpoint test just
 * signed with, so the receiver already holds it; without one the server generates it.
 */
export const ZWebhookCreateBody = ZWebhookSettings.extend({
  secret: z.string().max(WEBHOOK_SECRET_MAX).optional(),
}).strict();
export type TWebhookCreateBody = z.infer<typeof ZWebhookCreateBody>;

/** `PUT /api/internal/webhooks/{webhookId}`: the webhook's settings, replaced as the settings tab saves them. */
export const ZWebhookUpdateBody = ZWebhookSettings;
export type TWebhookUpdateBody = z.infer<typeof ZWebhookUpdateBody>;

/**
 * `POST /api/internal/webhooks/test-deliveries?workspaceId=`: send a signed test payload to `url`. With
 * `webhookId`, the existing webhook's own workspace is authorized and its stored secret signs; without it,
 * the payload is signed with `secret`, or a newly generated one, for the webhook about to be created.
 */
export const ZWebhookTestDeliveryBody = z
  .object({
    url: z.string().max(WEBHOOK_URL_MAX),
    webhookId: ZId.optional(),
    secret: z.string().max(WEBHOOK_SECRET_MAX).optional(),
  })
  .strict();
export type TWebhookTestDeliveryBody = z.infer<typeof ZWebhookTestDeliveryBody>;
