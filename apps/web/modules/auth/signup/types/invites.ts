import { Invite, User } from "@formbricks/database/prisma";

export interface InviteWithCreator extends Pick<Invite, "id" | "organizationId" | "role" | "teamIds"> {
  creator: Pick<User, "name" | "email" | "locale">;
}

export type CreateMembershipInvite = Pick<Invite, "organizationId" | "role" | "teamIds">;
