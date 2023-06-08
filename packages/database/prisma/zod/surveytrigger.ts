import * as z from "zod"
import * as imports from "../zod-utils"
import { CompleteSurvey, SurveyModel, CompleteEventClass, EventClassModel } from "./index"

export const _SurveyTriggerModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string(),
  eventClassId: z.string(),
})

export interface CompleteSurveyTrigger extends z.infer<typeof _SurveyTriggerModel> {
  survey: CompleteSurvey
  eventClass: CompleteEventClass
}

/**
 * SurveyTriggerModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const SurveyTriggerModel: z.ZodSchema<CompleteSurveyTrigger> = z.lazy(() => _SurveyTriggerModel.extend({
  survey: SurveyModel,
  eventClass: EventClassModel,
}))
