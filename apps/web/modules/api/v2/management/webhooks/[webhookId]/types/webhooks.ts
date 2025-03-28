import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

extendZodWithOpenApi(z);

export const webhookIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "webhookId",
    description: "The ID of the webhook",
    param: {
      name: "id",
      in: "path",
    },
  });

export const webhookUpdateSchema = ZWebhook.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  environmentId: true,
}).openapi({
  ref: "webhookUpdate",
  description: "A webhook to update.",
});
