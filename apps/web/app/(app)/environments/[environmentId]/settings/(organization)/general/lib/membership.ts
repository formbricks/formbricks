import "server-only";
import { membershipCache } from "@/lib/cache/membership";
import { organizationCache } from "@/lib/cache/organization";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { TMember, TMembership } from "@formbricks/types/memberships";

export const getMembersByOrganizationId = reactCache(
  (organizationId: string, page?: number): Promise<TMember[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZString], [page, ZOptionalNumber]);

        try {
          const membersData = await prisma.membership.findMany({
            where: { organizationId },
            select: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
              userId: true,
              accepted: true,
              organizationRole: true,
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
              organizationRole: member.organizationRole,
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
      [`getMembersByOrganizationId-${organizationId}-${page}`],
      {
        tags: [membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const deleteMembership = async (userId: string, organizationId: string): Promise<TMembership> => {
  validateInputs([userId, ZString], [organizationId, ZString]);

  try {
    const deletedTeamMemberships = prisma.teamMembership.findMany({
      where: {
        userId,
        team: {
          organizationId,
        },
      },
    });

    await prisma.$transaction([
      prisma.teamMembership.deleteMany({
        where: {
          userId,
          team: {
            organizationId,
          },
        },
      }),
      prisma.membership.delete({
        where: {
          userId_organizationId: {
            organizationId,
            userId,
          },
        },
      }),
    ]);

    teamCache.revalidate({
      userId,
      organizationId,
    });

    deletedTeamMemberships.forEach((teamMembership) => {
      teamCache.revalidate({
        id: teamMembership.teamId,
      });
    });

    organizationCache.revalidate({
      userId,
    });

    membershipCache.revalidate({
      userId,
      organizationId,
    });

    return deletedMembership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getMembershipsByUserId = reactCache(
  (userId: string, page?: number): Promise<TMembership[]> =>
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
    )()
);
