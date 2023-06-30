import { z } from "zod";
import { ZPipelineTrigger } from "./pipelines";

export const ZWebhook = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string().url(),
  environmentId: z.string().cuid2(),
  triggers: z.array(ZPipelineTrigger),
});

export type TWebhook = z.infer<typeof ZWebhook>;

export const ZWebhookInput = z.object({
  url: z.string().url(),
  trigger: ZPipelineTrigger,
});

export type TWebhookInput = z.infer<typeof ZWebhookInput>;
