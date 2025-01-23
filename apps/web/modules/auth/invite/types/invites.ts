import { Invite } from "@prisma/client";
import { z } from "zod";
import { ZInvite } from "@formbricks/database/zod/invites";

export const ZInviteWithCreator = ZInvite.pick({
  id: true,
  expiresAt: true,
  organizationId: true,
  role: true,
  teamIds: true,
}).extend({
  creator: z.object({
    name: z.string().nullable(),
    email: z.string(),
  }),
});

export type InviteWithCreator = z.infer<typeof ZInviteWithCreator>;

export interface CreateMembershipInvite extends Pick<Invite, "organizationId" | "role" | "teamIds"> {}
