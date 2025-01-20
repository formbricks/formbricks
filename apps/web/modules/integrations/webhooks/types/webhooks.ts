import { z } from "zod";
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
