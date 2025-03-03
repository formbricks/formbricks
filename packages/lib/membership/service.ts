import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { TMembership, ZMembership } from "@formbricks/types/memberships";
import { cache } from "../cache";
import { membershipCache } from "../membership/cache";
import { organizationCache } from "../organization/cache";
import { validateInputs } from "../utils/validate";

export const getMembershipByUserIdOrganizationId = reactCache(
  async (userId: string, organizationId: string): Promise<TMembership | null> =>
    cache(
      async () => {
        validateInputs([userId, ZString], [organizationId, ZString]);

        try {
          const membership = await prisma.membership.findUnique({
            where: {
              userId_organizationId: {
                userId,
                organizationId,
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
      [`getMembershipByUserIdOrganizationId-${userId}-${organizationId}`],
      {
        tags: [membershipCache.tag.byUserId(userId), membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const createMembership = async (
  organizationId: string,
  userId: string,
  data: Partial<TMembership>
): Promise<TMembership> => {
  validateInputs([organizationId, ZString], [userId, ZString], [data, ZMembership.partial()]);

  try {
    const membership = await prisma.membership.create({
      data: {
        userId,
        organizationId,
        accepted: data.accepted,
        role: data.role as TMembership["role"],
      },
    });
    organizationCache.revalidate({
      userId,
    });

    membershipCache.revalidate({
      userId,
      organizationId,
    });

    return membership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
