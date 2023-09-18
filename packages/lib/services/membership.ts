import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/v1/errors";
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

export const getMembershipByUserId = cache(
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

export const getAllMembershipsByUserId = cache(async (userId: string) => {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          products: {
            select: {
              id: true,
              name: true,
              environments: {
                select: {
                  id: true,
                  type: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return memberships;
});

export const updateMembership = cache(
  async (userId: string, teamId: string, data: TMembershipUpdateInput): Promise<TMembership> => {
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
      } else {
        throw error; // Re-throw any other errors
      }
    }
  }
);

export const deleteMembership = cache(async (userId: string, teamId: string): Promise<TMembership> => {
  const deletedMembership = await prisma.membership.delete({
    where: {
      userId_teamId: {
        teamId,
        userId,
      },
    },
  });

  return deletedMembership;
});

export const transferOwnership = cache(async (currentOwnerId: string, newOwnerId: string, teamId: string) => {
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
    throw new Error("Something went wrong");
  }
});
