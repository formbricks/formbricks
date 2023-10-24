import "server-only";

import { prisma } from "@formbricks/database";
import { ResourceNotFoundError, DatabaseError, UnknownError } from "@formbricks/types/errors";
import {
  TMember,
  TMembership,
  ZMembership,
  TMembershipUpdateInput,
  ZMembershipUpdateInput,
} from "@formbricks/types/memberships";
import { Prisma } from "@prisma/client";
import { validateInputs } from "../utils/validate";
import { ZString, ZOptionalNumber } from "@formbricks/types/common";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { unstable_cache } from "next/cache";
import { membershipCache } from "./cache";
import { teamCache } from "../team/cache";

export const getMembersByTeamId = async (teamId: string, page?: number): Promise<TMember[]> =>
  unstable_cache(
    async () => {
      validateInputs([teamId, ZString], [page, ZOptionalNumber]);

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
    },
    [`getMembersByTeamId-${teamId}-${page}`],
    {
      tags: [membershipCache.tag.byTeamId(teamId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getMembershipByUserIdTeamId = async (
  userId: string,
  teamId: string
): Promise<TMembership | null> =>
  unstable_cache(
    async () => {
      validateInputs([userId, ZString], [teamId, ZString]);

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
    },
    [`getMembershipByUserIdTeamId-${userId}-${teamId}`],
    {
      tags: [membershipCache.tag.byUserIdTeamId(userId, teamId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getMembershipsByUserId = async (userId: string, page?: number): Promise<TMembership[]> =>
  unstable_cache(
    async () => {
      validateInputs([userId, ZString], [page, ZOptionalNumber]);

      const memberships = await prisma.membership.findMany({
        where: {
          userId,
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      return memberships;
    },
    [`getMembershipsByUserId-${userId}-${page}`],
    {
      tags: [membershipCache.tag.byUserId(userId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
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
      id: teamId,
    });

    membershipCache.revalidate({
      userId,
      teamId,
    });

    return membership;
  } catch (error) {
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
      id: teamId,
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
    id: teamId,
  });

  membershipCache.revalidate({
    userId,
    teamId,
  });

  return deletedMembership;
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

    teamCache.revalidate({
      id: teamId,
    });

    memberships.forEach((membership) => {
      teamCache.revalidate({
        id: membership.teamId,
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
