import * as z from "zod"
import * as imports from "../zod-utils"
import { CompleteTeam, TeamModel, CompleteEnvironment, EnvironmentModel } from "./index"

export const _ProductModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  teamId: z.string(),
  brandColor: z.string(),
  recontactDays: z.number().int(),
  formbricksSignature: z.boolean(),
})

export interface CompleteProduct extends z.infer<typeof _ProductModel> {
  team: CompleteTeam
  environments: CompleteEnvironment[]
}

/**
 * ProductModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const ProductModel: z.ZodSchema<CompleteProduct> = z.lazy(() => _ProductModel.extend({
  team: TeamModel,
  environments: EnvironmentModel.array(),
}))
