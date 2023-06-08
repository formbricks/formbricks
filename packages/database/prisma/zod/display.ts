import * as z from "zod"
import * as imports from "../zod-utils"
import { DisplayStatus } from "@prisma/client"
import { CompleteSurvey, SurveyModel, CompletePerson, PersonModel } from "./index"

export const _DisplayModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string(),
  personId: z.string().nullish(),
  status: z.nativeEnum(DisplayStatus),
})

export interface CompleteDisplay extends z.infer<typeof _DisplayModel> {
  survey: CompleteSurvey
  person?: CompletePerson | null
}

/**
 * DisplayModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const DisplayModel: z.ZodSchema<CompleteDisplay> = z.lazy(() => _DisplayModel.extend({
  survey: SurveyModel,
  person: PersonModel.nullish(),
}))
