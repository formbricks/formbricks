import * as z from "zod"
import * as imports from "../zod-utils"
import { CompleteEventClass, EventClassModel, CompleteSession, SessionModel } from "./index"

// Helper schema for JSON fields
type Literal = boolean | number | string
type Json = Literal | { [key: string]: Json } | Json[]
const literalSchema = z.union([z.string(), z.number(), z.boolean()])
const jsonSchema: z.ZodSchema<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]))

export const _EventModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  eventClassId: z.string().nullish(),
  sessionId: z.string(),
  properties: imports.ZEventProperties,
})

export interface CompleteEvent extends z.infer<typeof _EventModel> {
  eventClass?: CompleteEventClass | null
  session: CompleteSession
}

/**
 * EventModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const EventModel: z.ZodSchema<CompleteEvent> = z.lazy(() => _EventModel.extend({
  eventClass: EventClassModel.nullish(),
  session: SessionModel,
}))
