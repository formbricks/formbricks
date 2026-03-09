import type { Webhook } from "@prisma/client";
import { z } from "zod";

export const ZWebhook = z.object({
  id: z.cuid2().describe("The ID of the webhook"),
  name: z.string().nullable().describe("The name of the webhook"),
  createdAt: z
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the webhook was created"),
  updatedAt: z
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the webhook was last updated"),
  url: z.url().describe("The URL of the webhook"),
  source: z.enum(["user", "zapier", "make", "n8n"]).describe("The source of the webhook"),
  environmentId: z.cuid2().describe("The ID of the environment"),
  triggers: z
    .array(z.enum(["responseFinished", "responseCreated", "responseUpdated"]))
    .describe("The triggers of the webhook")
    .min(1, {
      error: "At least one trigger is required",
    }),
  surveyIds: z.array(z.cuid2()).describe("The IDs of the surveys "),
  secret: z
    .string()
    .nullable()
    .describe("The shared secret used to generate HMAC signatures for webhook requests"),
}) satisfies z.ZodType<Webhook>;

ZWebhook.meta({
  id: "webhook",
}).describe("A webhook");
