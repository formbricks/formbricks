import * as z from "zod"
import * as imports from "../zod-utils"
import { SurveyAttributeFilterCondition } from "@prisma/client"
import { CompleteAttributeClass, AttributeClassModel, CompleteSurvey, SurveyModel } from "./index"

export const _SurveyAttributeFilterModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  attributeClassId: z.string(),
  surveyId: z.string(),
  condition: z.nativeEnum(SurveyAttributeFilterCondition),
  value: z.string(),
})

export interface CompleteSurveyAttributeFilter extends z.infer<typeof _SurveyAttributeFilterModel> {
  attributeClass: CompleteAttributeClass
  survey: CompleteSurvey
}

/**
 * SurveyAttributeFilterModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const SurveyAttributeFilterModel: z.ZodSchema<CompleteSurveyAttributeFilter> = z.lazy(() => _SurveyAttributeFilterModel.extend({
  attributeClass: AttributeClassModel,
  survey: SurveyModel,
}))
