import { z } from "zod";
import { ZPipelineTrigger } from "./pipelines";

export const ZWebhookSource = z.enum(["user", "zapier", "make", "n8n"]);

export const ZWebhook = z.object({
  id: z.string().cuid2(),
  name: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string().url(),
  source: ZWebhookSource,
  environmentId: z.string().cuid2(),
  triggers: z.array(ZPipelineTrigger),
  surveyIds: z.array(z.string().cuid2()),
});

export type TWebhook = z.infer<typeof ZWebhook>;

export const ZWebhookInput = z.object({
  url: z.string().url(),
  name: z.string().nullish(),
  triggers: z.array(ZPipelineTrigger),
  source: ZWebhookSource.optional(),
  surveyIds: z.array(z.string().cuid2()).optional(),
});

export type TWebhookInput = z.infer<typeof ZWebhookInput>;
