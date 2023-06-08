import * as z from "zod"
import * as imports from "../zod-utils"
import { CompleteAttributeClass, AttributeClassModel, CompletePerson, PersonModel } from "./index"

export const _AttributeModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  attributeClassId: z.string(),
  personId: z.string(),
  value: z.string(),
})

export interface CompleteAttribute extends z.infer<typeof _AttributeModel> {
  attributeClass: CompleteAttributeClass
  person: CompletePerson
}

/**
 * AttributeModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const AttributeModel: z.ZodSchema<CompleteAttribute> = z.lazy(() => _AttributeModel.extend({
  attributeClass: AttributeClassModel,
  person: PersonModel,
}))
