import * as z from "zod"
import * as imports from "../zod-utils"
import { IdentityProvider, Role, Objective } from "@prisma/client"
import { CompleteMembership, MembershipModel, CompleteAccount, AccountModel, CompleteInvite, InviteModel } from "./index"

// Helper schema for JSON fields
type Literal = boolean | number | string
type Json = Literal | { [key: string]: Json } | Json[]
const literalSchema = z.union([z.string(), z.number(), z.boolean()])
const jsonSchema: z.ZodSchema<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]))

export const _UserModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().nullish(),
  email: z.string(),
  emailVerified: z.date().nullish(),
  password: z.string().nullish(),
  onboardingCompleted: z.boolean(),
  identityProvider: z.nativeEnum(IdentityProvider),
  identityProviderAccountId: z.string().nullish(),
  groupId: z.string().nullish(),
  role: z.nativeEnum(Role).nullish(),
  objective: z.nativeEnum(Objective).nullish(),
  notificationSettings: imports.ZUserNotificationSettings,
})

export interface CompleteUser extends z.infer<typeof _UserModel> {
  memberships: CompleteMembership[]
  accounts: CompleteAccount[]
  invitesCreated: CompleteInvite[]
  invitesAccepted: CompleteInvite[]
}

/**
 * UserModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const UserModel: z.ZodSchema<CompleteUser> = z.lazy(() => _UserModel.extend({
  memberships: MembershipModel.array(),
  accounts: AccountModel.array(),
  invitesCreated: InviteModel.array(),
  invitesAccepted: InviteModel.array(),
}))
