import { Invite } from "@prisma/client";
import { z } from "zod";
import { ZInvite } from "@formbricks/database/zod/invites";
import { ZUserName } from "@formbricks/types/user";

export interface TInvite
  extends Omit<Invite, "deprecatedRole" | "organizationId" | "creatorId" | "acceptorId" | "teamIds"> {}

export interface InviteWithCreator extends Pick<Invite, "email"> {
  creator: {
    name: string;
  };
}

export const ZInvitee = ZInvite.pick({
  email: true,
  role: true,
  teamIds: true,
}).extend({
  name: ZUserName,
});

export type TInvitee = z.infer<typeof ZInvitee>;

export const ZInvitees = z.array(ZInvitee);
