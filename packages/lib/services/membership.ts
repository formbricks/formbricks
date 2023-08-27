import { prisma } from "@formbricks/database";
import { TMember, TMembership } from "@formbricks/types/v1/memberships";
import { cache } from "react";

export const getMembers = cache(async (teamId: string): Promise<TMember[]> => {
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
