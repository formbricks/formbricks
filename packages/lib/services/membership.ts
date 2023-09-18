import { prisma } from "@formbricks/database";
import { TMembership } from "@formbricks/types/v1/memberships";
import { cache } from "react";

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
