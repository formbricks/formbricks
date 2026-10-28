import type { Webhook } from "@formbricks/database/prisma";
import type { TV3WebhookResource } from "./lib/schemas";

/** A webhook row without its signing secret, which is what every read selects. */
export type TWebhookWithoutSecret = Omit<Webhook, "secret">;

export const serializeV3Webhook = (webhook: TWebhookWithoutSecret): TV3WebhookResource => ({
  id: webhook.id,
  workspaceId: webhook.workspaceId,
  name: webhook.name,
  url: webhook.url,
  source: webhook.source,
  triggers: webhook.triggers,
  surveyIds: webhook.surveyIds,
  createdAt: webhook.createdAt.toISOString(),
  updatedAt: webhook.updatedAt.toISOString(),
});
