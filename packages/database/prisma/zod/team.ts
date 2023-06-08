import * as z from "zod"
import * as imports from "../zod-utils"
import { Plan } from "@prisma/client"
import { CompleteMembership, MembershipModel, CompleteProduct, ProductModel, CompleteInvite, InviteModel } from "./index"

export const _TeamModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  plan: z.nativeEnum(Plan),
  stripeCustomerId: z.string().nullish(),
})

export interface CompleteTeam extends z.infer<typeof _TeamModel> {
  memberships: CompleteMembership[]
  products: CompleteProduct[]
  invites: CompleteInvite[]
}

/**
 * TeamModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const TeamModel: z.ZodSchema<CompleteTeam> = z.lazy(() => _TeamModel.extend({
  memberships: MembershipModel.array(),
  products: ProductModel.array(),
  invites: InviteModel.array(),
}))
