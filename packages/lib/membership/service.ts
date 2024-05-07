import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError, UnknownError } from "@formbricks/types/errors";
import {
  TMember,
  TMembership,
  TMembershipUpdateInput,
  ZMembership,
  ZMembershipUpdateInput,
} from "@formbricks/types/memberships";

import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { teamCache } from "../team/cache";
import { validateInputs } from "../utils/validate";
import { membershipCache } from "./cache";

export const getMembersByTeamId = async (teamId: string, page?: number): Promise<TMember[]> =>
  cache(
    async () => {
      validateInputs([teamId, ZString], [page, ZOptionalNumber]);

      try {
        const membersData = await prisma.membership.findMany({
          where: { teamId },
          select: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            userId: true,
            accepted: true,
            role: true,
          },
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });

        const members = membersData.map((member) => {
          return {
            name: member.user?.name || "",
            email: member.user?.email || "",
            userId: member.userId,
            accepted: member.accepted,
            role: member.role,
          };
        });

        return members;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw new UnknownError("Error while fetching members");
      }
    },
    [`getMembersByTeamId-${teamId}-${page}`],
    {
      tags: [membershipCache.tag.byTeamId(teamId)],
    }
  )();

export const getMembershipByUserIdTeamId = async (
  userId: string,
  teamId: string
): Promise<TMembership | null> =>
  cache(
    async () => {
      validateInputs([userId, ZString], [teamId, ZString]);

      try {
        const membership = await prisma.membership.findUnique({
          where: {
            userId_teamId: {
              userId,
              teamId,
            },
          },
        });

        if (!membership) return null;

        return membership;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw new UnknownError("Error while fetching membership");
      }
    },
    [`getMembershipByUserIdTeamId-${userId}-${teamId}`],
    {
      tags: [membershipCache.tag.byUserId(userId), membershipCache.tag.byTeamId(teamId)],
    }
  )();

export const getMembershipsByUserId = async (userId: string, page?: number): Promise<TMembership[]> =>
  cache(
    async () => {
      validateInputs([userId, ZString], [page, ZOptionalNumber]);

      try {
        const memberships = await prisma.membership.findMany({
          where: {
            userId,
          },
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });

        return memberships;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getMembershipsByUserId-${userId}-${page}`],
    {
      tags: [membershipCache.tag.byUserId(userId)],
    }
  )();

export const createMembership = async (
  teamId: string,
  userId: string,
  data: Partial<TMembership>
): Promise<TMembership> => {
  validateInputs([teamId, ZString], [userId, ZString], [data, ZMembership.partial()]);

  try {
    const membership = await prisma.membership.create({
      data: {
        userId,
        teamId,
        accepted: data.accepted,
        role: data.role as TMembership["role"],
      },
    });
    teamCache.revalidate({
      userId,
    });

    membershipCache.revalidate({
      userId,
      teamId,
    });

    return membership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateMembership = async (
  userId: string,
  teamId: string,
  data: TMembershipUpdateInput
): Promise<TMembership> => {
  validateInputs([userId, ZString], [teamId, ZString], [data, ZMembershipUpdateInput]);

  try {
    const membership = await prisma.membership.update({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
      data,
    });

    teamCache.revalidate({
      userId,
    });

    membershipCache.revalidate({
      userId,
      teamId,
    });

    return membership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Membership", `userId: ${userId}, teamId: ${teamId}`);
    }

    throw error;
  }
};

export const deleteMembership = async (userId: string, teamId: string): Promise<TMembership> => {
  validateInputs([userId, ZString], [teamId, ZString]);

  try {
    const deletedMembership = await prisma.membership.delete({
      where: {
        userId_teamId: {
          teamId,
          userId,
        },
      },
    });

    teamCache.revalidate({
      userId,
    });

    membershipCache.revalidate({
      userId,
      teamId,
    });

    return deletedMembership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const transferOwnership = async (
  currentOwnerId: string,
  newOwnerId: string,
  teamId: string
): Promise<TMembership[]> => {
  validateInputs([currentOwnerId, ZString], [newOwnerId, ZString], [teamId, ZString]);

  try {
    const memberships = await prisma.$transaction([
      prisma.membership.update({
        where: {
          userId_teamId: {
            teamId,
            userId: currentOwnerId,
          },
        },
        data: {
          role: "admin",
        },
      }),
      prisma.membership.update({
        where: {
          userId_teamId: {
            teamId,
            userId: newOwnerId,
          },
        },
        data: {
          role: "owner",
        },
      }),
    ]);

    memberships.forEach((membership) => {
      teamCache.revalidate({
        userId: membership.userId,
      });

      membershipCache.revalidate({
        userId: membership.userId,
        teamId: membership.teamId,
      });
    });

    return memberships;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    const message = error instanceof Error ? error.message : "";
    throw new UnknownError(`Error while transfering ownership: ${message}`);
  }
};
