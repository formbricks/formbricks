import * as z from "zod"
import * as imports from "../zod-utils"
import { AttributeType } from "@prisma/client"
import { CompleteEnvironment, EnvironmentModel, CompleteAttribute, AttributeModel, CompleteSurveyAttributeFilter, SurveyAttributeFilterModel } from "./index"

export const _AttributeClassModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  description: z.string().nullish(),
  type: z.nativeEnum(AttributeType),
  environmentId: z.string(),
})

export interface CompleteAttributeClass extends z.infer<typeof _AttributeClassModel> {
  environment: CompleteEnvironment
  attributes: CompleteAttribute[]
  attributeFilters: CompleteSurveyAttributeFilter[]
}

/**
 * AttributeClassModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const AttributeClassModel: z.ZodSchema<CompleteAttributeClass> = z.lazy(() => _AttributeClassModel.extend({
  environment: EnvironmentModel,
  attributes: AttributeModel.array(),
  attributeFilters: SurveyAttributeFilterModel.array(),
}))
