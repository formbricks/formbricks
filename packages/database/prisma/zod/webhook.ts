import * as z from "zod"
import * as imports from "../zod-utils"
import { PipelineTriggers } from "@prisma/client"
import { CompleteEnvironment, EnvironmentModel } from "./index"

export const _WebhookModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string(),
  environmentId: z.string(),
  triggers: z.nativeEnum(PipelineTriggers).array(),
})

export interface CompleteWebhook extends z.infer<typeof _WebhookModel> {
  environment: CompleteEnvironment
}

/**
 * WebhookModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const WebhookModel: z.ZodSchema<CompleteWebhook> = z.lazy(() => _WebhookModel.extend({
  environment: EnvironmentModel,
}))
