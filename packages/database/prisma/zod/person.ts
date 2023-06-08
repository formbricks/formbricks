import * as z from "zod"
import * as imports from "../zod-utils"
import { CompleteEnvironment, EnvironmentModel, CompleteResponse, ResponseModel, CompleteSession, SessionModel, CompleteAttribute, AttributeModel, CompleteDisplay, DisplayModel } from "./index"

export const _PersonModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: z.string(),
})

export interface CompletePerson extends z.infer<typeof _PersonModel> {
  environment: CompleteEnvironment
  responses: CompleteResponse[]
  sessions: CompleteSession[]
  attributes: CompleteAttribute[]
  displays: CompleteDisplay[]
}

/**
 * PersonModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const PersonModel: z.ZodSchema<CompletePerson> = z.lazy(() => _PersonModel.extend({
  environment: EnvironmentModel,
  responses: ResponseModel.array(),
  sessions: SessionModel.array(),
  attributes: AttributeModel.array(),
  displays: DisplayModel.array(),
}))
