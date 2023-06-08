import * as z from "zod"
import * as imports from "../zod-utils"
import { CompleteEnvironment, EnvironmentModel } from "./index"

export const _ApiKeyModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  lastUsedAt: z.date().nullish(),
  label: z.string().nullish(),
  hashedKey: z.string(),
  environmentId: z.string(),
})

export interface CompleteApiKey extends z.infer<typeof _ApiKeyModel> {
  environment: CompleteEnvironment
}

/**
 * ApiKeyModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const ApiKeyModel: z.ZodSchema<CompleteApiKey> = z.lazy(() => _ApiKeyModel.extend({
  environment: EnvironmentModel,
}))
