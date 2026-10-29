import { prisma } from "@formbricks/database";
import { Invite, Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { type TInvitee } from "../types/invites";

export const refreshInviteExpiration = async (inviteId: string): Promise<Invite> => {
  try {
    const updatedInvite = await prisma.invite.update({
      where: { id: inviteId },
      data: {
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      },
    });

    return updatedInvite;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordNotFound) {
        throw new ResourceNotFoundError("Invite", inviteId);
      }
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/**
 * The preconditions every invite faces: no invite for this address exists yet and its owner is not already
 * a member. Throws `InvalidInputError` with a fixed message otherwise. Returns the existing user for the
 * address, if any, so the invite can be tied to them.
 *
 * `inviteUser` runs it, and so does the agent invite preview, which must answer the same refusal the
 * confirmed call would without writing anything.
 */
export const assertInviteIsNew = async ({
  email,
  organizationId,
}: {
  email: string;
  organizationId: string;
}) => {
  const existingInvite = await prisma.invite.findFirst({ where: { email, organizationId } });

  if (existingInvite) {
    throw new InvalidInputError("Invite already exists");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const member = await getMembershipByUserIdOrganizationId(user.id, organizationId);

    if (member) {
      throw new InvalidInputError("User is already a member of this organization");
    }
  }

  return user;
};

export const inviteUser = async ({
  invitee,
  organizationId,
  currentUserId,
}: {
  organizationId: string;
  invitee: TInvitee;
  currentUserId: string;
}): Promise<string> => {
  try {
    const { name, email, role, teamIds } = invitee;

    const user = await assertInviteIsNew({ email, organizationId });

    const teamIdsSet = new Set(teamIds);

    if (teamIdsSet.size !== teamIds.length) {
      throw new ValidationError("teamIds must be unique");
    }

    const teams = await prisma.team.findMany({
      where: {
        id: { in: teamIds },
        organizationId,
      },
    });

    if (teams.length !== teamIds.length) {
      throw new ValidationError("Invalid teamIds");
    }

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
    const expiresAt = new Date(Date.now() + expiresIn);

    const invite = await prisma.invite.create({
      data: {
        email,
        name,
        organization: { connect: { id: organizationId } },
        creator: { connect: { id: currentUserId } },
        acceptor: user ? { connect: { id: user.id } } : undefined,
        role,
        expiresAt,
        teamIds: { set: teamIds },
      },
    });

    return invite.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteInvite = async (inviteId: string): Promise<boolean> => {
  try {
    const invite = await prisma.invite.delete({
      where: {
        id: inviteId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!invite) {
      throw new ResourceNotFoundError("Invite", inviteId);
    }

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
