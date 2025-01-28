import { Invite } from "@prisma/client";

export interface InviteWithCreator
  extends Pick<Invite, "id" | "expiresAt" | "organizationId" | "role" | "teamIds"> {
  creator: {
    name: string | null;
    email: string;
  };
}

export interface CreateMembershipInvite extends Pick<Invite, "organizationId" | "role" | "teamIds"> {}
