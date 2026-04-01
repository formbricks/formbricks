import { z } from "zod";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

export const ZWebhookIdSchema = z
  .cuid2()
  .meta({
    id: "webhookId",
    param: {
      name: "id",
      in: "path",
    },
  })
  .describe("The ID of the webhook");

export const ZWebhookUpdateSchema = ZWebhook.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  environmentId: true,
  secret: true,
}).meta({
  id: "webhookUpdate",
  description: "A webhook to update.",
});
