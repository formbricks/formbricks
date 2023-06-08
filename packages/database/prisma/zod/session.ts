import * as z from "zod"
import * as imports from "../zod-utils"
import { CompletePerson, PersonModel, CompleteEvent, EventModel } from "./index"

export const _SessionModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  personId: z.string(),
})

export interface CompleteSession extends z.infer<typeof _SessionModel> {
  person: CompletePerson
  events: CompleteEvent[]
}

/**
 * SessionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const SessionModel: z.ZodSchema<CompleteSession> = z.lazy(() => _SessionModel.extend({
  person: PersonModel,
  events: EventModel.array(),
}))
