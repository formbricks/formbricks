import { ITEMS_PER_PAGE } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { validateInputs } from "@/lib/utils/validate";
import { Invite, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { type InviteWithCreator, type TInvite, type TInvitee } from "../types/invites";

export const resendInvite = async (inviteId: string): Promise<Pick<Invite, "email" | "name">> => {
  try {
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

    const updatedInvite = await prisma.invite.update({
      where: {
        id: inviteId,
      },
      data: {
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      select: {
        id: true,
        email: true,
        name: true,
        organizationId: true,
      },
    });

    return {
      email: updatedInvite.email,
      name: updatedInvite.name,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
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

export const getInvite = reactCache(async (inviteId: string): Promise<InviteWithCreator | null> => {
  try {
    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId,
      },
      select: {
        email: true,
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
