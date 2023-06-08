import * as z from "zod"
import * as imports from "../zod-utils"
import { SurveyType, SurveyStatus, displayOptions } from "@prisma/client"
import { CompleteEnvironment, EnvironmentModel, CompleteResponse, ResponseModel, CompleteSurveyTrigger, SurveyTriggerModel, CompleteSurveyAttributeFilter, SurveyAttributeFilterModel, CompleteDisplay, DisplayModel } from "./index"

// Helper schema for JSON fields
type Literal = boolean | number | string
type Json = Literal | { [key: string]: Json } | Json[]
const literalSchema = z.union([z.string(), z.number(), z.boolean()])
const jsonSchema: z.ZodSchema<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]))

export const _SurveyModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  type: z.nativeEnum(SurveyType),
  environmentId: z.string(),
  status: z.nativeEnum(SurveyStatus),
  questions: imports.ZSurveyQuestions,
  thankYouCard: imports.ZSurveyThankYouCard,
  displayOption: z.nativeEnum(displayOptions),
  recontactDays: z.number().int().nullish(),
  autoClose: z.number().int().nullish(),
})

export interface CompleteSurvey extends z.infer<typeof _SurveyModel> {
  environment: CompleteEnvironment
  responses: CompleteResponse[]
  triggers: CompleteSurveyTrigger[]
  attributeFilters: CompleteSurveyAttributeFilter[]
  displays: CompleteDisplay[]
}

/**
 * SurveyModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const SurveyModel: z.ZodSchema<CompleteSurvey> = z.lazy(() => _SurveyModel.extend({
  environment: EnvironmentModel,
  responses: ResponseModel.array(),
  triggers: SurveyTriggerModel.array(),
  attributeFilters: SurveyAttributeFilterModel.array(),
  displays: DisplayModel.array(),
}))
