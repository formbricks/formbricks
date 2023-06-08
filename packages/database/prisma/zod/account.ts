import * as z from "zod"
import * as imports from "../zod-utils"
import { CompleteUser, UserModel } from "./index"

export const _AccountModel = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
  type: z.string(),
  provider: z.string(),
  providerAccountId: z.string(),
  access_token: z.string().nullish(),
  refresh_token: z.string().nullish(),
  expires_at: z.number().int().nullish(),
  token_type: z.string().nullish(),
  scope: z.string().nullish(),
  id_token: z.string().nullish(),
  session_state: z.string().nullish(),
})

export interface CompleteAccount extends z.infer<typeof _AccountModel> {
  user?: CompleteUser | null
}

/**
 * AccountModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const AccountModel: z.ZodSchema<CompleteAccount> = z.lazy(() => _AccountModel.extend({
  user: UserModel.nullish(),
}))
