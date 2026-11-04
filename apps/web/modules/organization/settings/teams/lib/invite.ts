import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Invite, type InviteWhereUniqueInput, Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { validateInputs } from "@/lib/utils/validate";
import { type InviteWithCreator, type TInvite, type TInvitee } from "../types/invites";

/**
 * Who may act on a pending invite: only an owner on an owner's invite, as with an owner's membership
 * (ENG-6812). Applied as the write's own `WHERE`, so an invite promoted to owner after the caller's
 * checks ran is not touched either.
 */
export type TInviteWriteScope = Readonly<{ allowOwnerInvite: boolean }>;

export const getInviteWriteWhere = (
  inviteId: string,
  { allowOwnerInvite }: TInviteWriteScope
): InviteWhereUniqueInput => (allowOwnerInvite ? { id: inviteId } : { id: inviteId, role: { not: "owner" } });

/**
 * The error for a scoped invite write that matched no row: the owner rule when the invite is there,
 * not found when it is not.
 */
export const getMissingInviteWriteError = async (
  inviteId: string,
  { allowOwnerInvite }: TInviteWriteScope
): Promise<Error> => {
  const exists =
    !allowOwnerInvite &&
    (await prisma.invite.findUnique({ where: { id: inviteId }, select: { id: true } })) !== null;

  return exists
    ? new OperationNotAllowedError("Only owners can change an owner invite")
    : new ResourceNotFoundError("Invite", inviteId);
};

export const refreshInviteExpiration = async (
  inviteId: string,
  scope: TInviteWriteScope
): Promise<Invite> => {
  try {
    const updatedInvite = await prisma.invite.update({
      where: getInviteWriteWhere(inviteId, scope),
      data: {
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      },
    });

    return updatedInvite;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordNotFound) {
        throw await getMissingInviteWriteError(inviteId, scope);
      }
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const resendInvite = async (
  inviteId: string,
  scope: TInviteWriteScope
): Promise<Pick<Invite, "email" | "name">> => {
  // Refresh expiration and return the updated invite (single query)
  const updatedInvite = await refreshInviteExpiration(inviteId, scope);

  return {
    email: updatedInvite.email,
    name: updatedInvite.name,
  };
};

export const getInvitesByOrganizationId = reactCache(
  async (organizationId: string, page?: number): Promise<TInvite[]> => {
    validateInputs([organizationId, z.string()], [page, z.number().optional()]);

    try {
      const invites = await prisma.invite.findMany({
        where: { organizationId },
        select: {
          expiresAt: true,
          role: true,
          email: true,
          name: true,
          id: true,
          createdAt: true,
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      return invites;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

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

export const deleteInvite = async (inviteId: string, scope: TInviteWriteScope): Promise<boolean> => {
  try {
    const invite = await prisma.invite.delete({
      where: getInviteWriteWhere(inviteId, scope),
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
      if (error.code === PrismaErrorType.RecordNotFound) {
        throw await getMissingInviteWriteError(inviteId, scope);
      }
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getInvite = reactCache(async (inviteId: string): Promise<InviteWithCreator | null> => {
  try {
    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId,
      },
      select: {
        email: true,
        // The invite-role audit event records this snapshot before and after, so it carries the role.
        role: true,
        creator: {
          select: {
            name: true,
          },
        },
      },
    });

    return invite;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
