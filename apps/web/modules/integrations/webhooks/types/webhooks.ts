import { z } from "zod";
import type { Webhook } from "@formbricks/database/prisma-browser";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

export const ZWebhookInput = ZWebhook.partial({
  name: true,
  source: true,
  surveyIds: true,
}).pick({
  name: true,
  source: true,
  surveyIds: true,
  triggers: true,
  url: true,
});

export type TWebhookInput = z.infer<typeof ZWebhookInput>;

/**
 * A webhook as the dashboard receives it. The signing secret never travels with the list: readers
 * only learn whether one is set, and a workspace writer fetches the value on demand.
 */
export type TWebhookListItem = Omit<Webhook, "secret"> & { hasSecret: boolean };
