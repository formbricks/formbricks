import * as z from "zod"
import * as imports from "../zod-utils"
import { MembershipRole } from "@prisma/client"
import { CompleteTeam, TeamModel, CompleteUser, UserModel } from "./index"

export const _InviteModel = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullish(),
  teamId: z.string(),
  creatorId: z.string(),
  acceptorId: z.string().nullish(),
  accepted: z.boolean(),
  createdAt: z.date(),
  expiresAt: z.date(),
  role: z.nativeEnum(MembershipRole),
})

export interface CompleteInvite extends z.infer<typeof _InviteModel> {
  team: CompleteTeam
  creator: CompleteUser
  acceptor?: CompleteUser | null
}

/**
 * InviteModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const InviteModel: z.ZodSchema<CompleteInvite> = z.lazy(() => _InviteModel.extend({
  team: TeamModel,
  creator: UserModel,
  acceptor: UserModel.nullish(),
}))
