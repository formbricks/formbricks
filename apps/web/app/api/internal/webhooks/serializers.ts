import type { Webhook } from "@formbricks/database/prisma";

/** A webhook as the settings tab reads it after a save. Never carries the signing secret. */
export type TWebhookResource = Pick<
  Webhook,
  "id" | "name" | "url" | "source" | "workspaceId" | "triggers" | "surveyIds"
>;

/**
 * A webhook just created: the one response that carries its signing secret, which the created dialog shows
 * once so the receiver can be set up to verify deliveries.
 */
export type TCreatedWebhookResource = TWebhookResource & { secret: string | null };

/** The outcome of a test delivery: the secret that signed it, which a new webhook is then created with. */
export type TWebhookTestDeliveryResource = { secret: string | null };

export const serializeWebhook = (webhook: TWebhookResource): TWebhookResource => ({
  id: webhook.id,
  name: webhook.name,
  url: webhook.url,
  source: webhook.source,
  workspaceId: webhook.workspaceId,
  triggers: webhook.triggers,
  surveyIds: webhook.surveyIds,
});

export const serializeCreatedWebhook = (webhook: Webhook): TCreatedWebhookResource => ({
  ...serializeWebhook(webhook),
  secret: webhook.secret,
});
