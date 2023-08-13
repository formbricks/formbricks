import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { TInvite, TInviteUpdateInput } from "@formbricks/types/v1/invites";
import { cache } from "react";
import { ResourceNotFoundError } from "@formbricks/errors";

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

export const updateInvite = cache(async (inviteId: string, data: TInviteUpdateInput): Promise<TInvite> => {
  try {
    const invite = await prisma.invite.update({
      where: { id: inviteId },
      data,
      select: inviteSelect,
    });

    return invite;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Invite", inviteId);
    } else {
      throw error; // Re-throw any other errors
    }
  }
});
