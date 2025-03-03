import type { Webhook } from "@prisma/client";
import { z } from "zod";

export const ZWebhook = z.object({
  id: z.string().cuid2(),
  name: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string().url(),
  source: z.enum(["user", "zapier", "make", "n8n"]),
  environmentId: z.string().cuid2(),
  triggers: z.array(z.enum(["responseFinished", "responseCreated", "responseUpdated"])),
  surveyIds: z.array(z.string().cuid2()),
}) satisfies z.ZodType<Webhook>;
