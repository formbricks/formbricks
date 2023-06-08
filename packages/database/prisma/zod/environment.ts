import * as z from "zod"
import * as imports from "../zod-utils"
import { EnvironmentType } from "@prisma/client"
import { CompleteProduct, ProductModel, CompleteSurvey, SurveyModel, CompletePerson, PersonModel, CompleteEventClass, EventClassModel, CompleteAttributeClass, AttributeClassModel, CompleteApiKey, ApiKeyModel, CompleteWebhook, WebhookModel } from "./index"

export const _EnvironmentModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  type: z.nativeEnum(EnvironmentType),
  productId: z.string(),
  widgetSetupCompleted: z.boolean(),
})

export interface CompleteEnvironment extends z.infer<typeof _EnvironmentModel> {
  product: CompleteProduct
  surveys: CompleteSurvey[]
  people: CompletePerson[]
  eventClasses: CompleteEventClass[]
  attributeClasses: CompleteAttributeClass[]
  apiKeys: CompleteApiKey[]
  webhooks: CompleteWebhook[]
}

/**
 * EnvironmentModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const EnvironmentModel: z.ZodSchema<CompleteEnvironment> = z.lazy(() => _EnvironmentModel.extend({
  product: ProductModel,
  surveys: SurveyModel.array(),
  people: PersonModel.array(),
  eventClasses: EventClassModel.array(),
  attributeClasses: AttributeClassModel.array(),
  apiKeys: ApiKeyModel.array(),
  webhooks: WebhookModel.array(),
}))
