import type { Webhook } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZWebhook = z.object({
  id: z.string().cuid2().openapi({
    description: "The ID of the webhook",
  }),
  name: z.string().nullable().openapi({
    description: "The name of the webhook",
  }),
  createdAt: z.date().openapi({
    description: "The date and time the webhook was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.date().openapi({
    description: "The date and time the webhook was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  url: z.string().url().openapi({
    description: "The URL of the webhook",
  }),
  source: z.enum(["user", "zapier", "make", "n8n"]).openapi({
    description: "The source of the webhook",
  }),
  environmentId: z.string().cuid2().openapi({
    description: "The ID of the environment",
  }),
  triggers: z
    .array(z.enum(["responseFinished", "responseCreated", "responseUpdated"]))
    .openapi({
      description: "The triggers of the webhook",
    })
    .min(1, {
      message: "At least one trigger is required",
    }),
  surveyIds: z.array(z.string().cuid2()).openapi({
    description: "The IDs of the surveys ",
  }),
}) satisfies z.ZodType<Webhook>;

ZWebhook.openapi({
  ref: "webhook",
  description: "A webhook",
});
