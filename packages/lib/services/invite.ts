import { prisma } from "@formbricks/database";
import { TInvite } from "@formbricks/types/v1/invites";
import { cache } from "react";

const inviteSelect = {
  id: true,
  email: true,
  name: true,
  teamId: true,
  creatorId: true,
  acceptorId: true,
  accepted: true,
  createdAt: true,
  expiresAt: true,
  role: true,
};

export const getInviteesByTeamId = cache(async (teamId: string): Promise<TInvite[] | null> => {
  const invites = await prisma.invite.findMany({
    where: { teamId },
    select: inviteSelect,
  });

  if (!invites) {
    return null;
  }

  return invites;
});
