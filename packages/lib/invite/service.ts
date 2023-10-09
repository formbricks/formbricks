import "server-only";

import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import {
  TInvite,
  TInvitee,
  ZInvitee,
  TInviteUpdateInput,
  ZInviteUpdateInput,
  ZCurrentUser,
  TCurrentUser,
} from "@formbricks/types/v1/invites";
import { ResourceNotFoundError, ValidationError } from "@formbricks/types/v1/errors";
import { ZString } from "@formbricks/types/v1/common";
import { sendInviteMemberEmail } from "../emails/emails";
import { validateInputs } from "../utils/validate";

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

export const getInvitesByTeamId = async (teamId: string): Promise<TInvite[] | null> => {
  validateInputs([teamId, ZString]);

  const invites = await prisma.invite.findMany({
    where: { teamId },
    select: inviteSelect,
  });

  return invites;
};

export const updateInvite = async (inviteId: string, data: TInviteUpdateInput): Promise<TInvite | null> => {
  validateInputs([inviteId, ZString], [data, ZInviteUpdateInput]);

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
};

export const deleteInvite = async (inviteId: string): Promise<TInvite | null> => {
  validateInputs([inviteId, ZString]);

  const deletedInvite = await prisma.invite.delete({
    where: {
      id: inviteId,
    },
  });

  return deletedInvite;
};

export const getInvite = async (inviteId: string): Promise<{ inviteId: string; email: string }> => {
  validateInputs([inviteId, ZString]);

  const invite = await prisma.invite.findUnique({
    where: {
      id: inviteId,
    },
    select: {
      email: true,
    },
  });

  if (!invite) {
    throw new ResourceNotFoundError("Invite", inviteId);
  }

  return {
    inviteId,
    email: invite.email,
  };
};

export const resendInvite = async (inviteId: string): Promise<TInvite> => {
  validateInputs([inviteId, ZString]);
  const invite = await prisma.invite.findUnique({
    where: {
      id: inviteId,
    },
    select: {
      email: true,
      name: true,
      creator: true,
    },
  });

  if (!invite) {
    throw new ResourceNotFoundError("Invite", inviteId);
  }

  await sendInviteMemberEmail(inviteId, invite.creator?.name ?? "", invite.name ?? "", invite.email);

  const updatedInvite = await prisma.invite.update({
    where: {
      id: inviteId,
    },
    data: {
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  return updatedInvite;
};

export const inviteUser = async ({
  currentUser,
  invitee,
  teamId,
}: {
  teamId: string;
  invitee: TInvitee;
  currentUser: TCurrentUser;
}): Promise<TInvite> => {
  validateInputs([teamId, ZString], [invitee, ZInvitee], [currentUser, ZCurrentUser]);

  const { name, email, role } = invitee;
  const { id: currentUserId, name: currentUserName } = currentUser;
  const existingInvite = await prisma.invite.findFirst({ where: { email, teamId } });

  if (existingInvite) {
    throw new ValidationError("Invite already exists");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const member = await prisma.membership.findUnique({
      where: {
        userId_teamId: { teamId, userId: user.id },
      },
    });
    if (member) {
      throw new ValidationError("User is already a member of this team");
    }
  }

  const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
  const expiresAt = new Date(Date.now() + expiresIn);

  const invite = await prisma.invite.create({
    data: {
      email,
      name,
      team: { connect: { id: teamId } },
      creator: { connect: { id: currentUserId } },
      acceptor: user ? { connect: { id: user.id } } : undefined,
      role,
      expiresAt,
    },
  });

  await sendInviteMemberEmail(invite.id, currentUserName, name, email);

  return invite;
};
