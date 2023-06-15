import { z } from "zod";

export const ZWebhookTrigger = z.enum(["responseFinished", "responseCreated", "responseUpdated"]);

export const ZWebhook = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string().url(),
  environmentId: z.string().cuid2(),
  triggers: z.array(ZWebhookTrigger),
});

export type TWebhook = z.infer<typeof ZWebhook>;

export const ZWebhookInput = z.object({
  url: z.string().url(),
  trigger: ZWebhookTrigger,
});

export type TWebhookInput = z.infer<typeof ZWebhookInput>;
