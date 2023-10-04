import "server-only";

import { prisma } from "@formbricks/database";
import { ResourceNotFoundError, DatabaseError, UnknownError } from "@formbricks/types/v1/errors";
import { TMember, TMembership, TMembershipUpdateInput } from "@formbricks/types/v1/memberships";
import { Prisma } from "@prisma/client";
import { cache } from "react";

export const getMembersByTeamId = cache(async (teamId: string): Promise<TMember[]> => {
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
});

export const getMembershipByUserIdTeamId = cache(
  async (userId: string, teamId: string): Promise<TMembership | null> => {
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
  }
);

export const getMembershipsByUserId = cache(async (userId: string): Promise<TMembership[]> => {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
    },
  });

  return memberships;
});

export const createMembership = async (
  teamId: string,
  userId: string,
  data: Partial<TMembership>
): Promise<TMembership> => {
  try {
    const membership = await prisma.membership.create({
      data: {
        userId,
        teamId,
        accepted: data.accepted,
        role: data.role as TMembership["role"],
      },
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

    return membership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Membership", `userId: ${userId}, teamId: ${teamId}`);
    }

    throw error;
  }
};

export const deleteMembership = async (userId: string, teamId: string): Promise<TMembership> => {
  const deletedMembership = await prisma.membership.delete({
    where: {
      userId_teamId: {
        teamId,
        userId,
      },
    },
  });

  return deletedMembership;
};

export const transferOwnership = async (currentOwnerId: string, newOwnerId: string, teamId: string) => {
  try {
    await prisma.$transaction([
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    const message = error instanceof Error ? error.message : "";
    throw new UnknownError(`Error while transfering ownership: ${message}`);
  }
};
