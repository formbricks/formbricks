import * as z from "zod"
import * as imports from "../zod-utils"
import { EventType } from "@prisma/client"
import { CompleteEvent, EventModel, CompleteEnvironment, EnvironmentModel, CompleteSurveyTrigger, SurveyTriggerModel } from "./index"

// Helper schema for JSON fields
type Literal = boolean | number | string
type Json = Literal | { [key: string]: Json } | Json[]
const literalSchema = z.union([z.string(), z.number(), z.boolean()])
const jsonSchema: z.ZodSchema<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]))

export const _EventClassModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  description: z.string().nullish(),
  type: z.nativeEnum(EventType),
  noCodeConfig: imports.ZEventClassNoCodeConfig,
  environmentId: z.string(),
})

export interface CompleteEventClass extends z.infer<typeof _EventClassModel> {
  events: CompleteEvent[]
  environment: CompleteEnvironment
  surveys: CompleteSurveyTrigger[]
}

/**
 * EventClassModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const EventClassModel: z.ZodSchema<CompleteEventClass> = z.lazy(() => _EventClassModel.extend({
  events: EventModel.array(),
  environment: EnvironmentModel,
  surveys: SurveyTriggerModel.array(),
}))
