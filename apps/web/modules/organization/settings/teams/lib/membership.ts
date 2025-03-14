import "server-only";
import { membershipCache } from "@/lib/cache/membership";
import { organizationCache } from "@/lib/cache/organization";
import { teamCache } from "@/lib/cache/team";
import { TOrganizationMember } from "@/modules/ee/teams/team-list/types/team";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { TMember } from "@formbricks/types/memberships";
import { TMembership } from "@formbricks/types/memberships";

export const getMembershipByOrganizationId = reactCache(
  async (organizationId: string, page?: number): Promise<TMember[]> =>
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
            logger.error(error, "Error fetching membership by organization id");
            throw new DatabaseError(error.message);
          }

          throw new UnknownError("Error while fetching members");
        }
      },
      [`getMembershipByOrganizationId-${organizationId}-${page}`],
      {
        tags: [membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const getOrganizationOwnerCount = reactCache(
  async (organizationId: string): Promise<number> =>
    cache(
      async () => {
        validateInputs([organizationId, ZString]);

        try {
          const ownersCount = await prisma.membership.count({
            where: {
              organizationId,
              role: "owner",
            },
          });

          return ownersCount;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getOrganizationOwnerCount-${organizationId}`],
      {
        tags: [membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const deleteMembership = async (
  userId: string,
  organizationId: string
): Promise<
  {
    userId: string;
    role: "admin" | "contributor";
    teamId: string;
  }[]
> => {
  validateInputs([userId, ZString], [organizationId, ZString]);

  try {
    const deletedTeamMemberships = await prisma.teamUser.findMany({
      where: {
        userId,
        team: {
          organizationId,
        },
      },
    });

    await prisma.$transaction([
      prisma.teamUser.deleteMany({
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

    return deletedTeamMemberships;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getMembershipsByUserId = reactCache(
  async (userId: string, page?: number): Promise<TMembership[]> =>
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

export const getMembersByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationMember[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZString]);

        try {
          const membersData = await prisma.membership.findMany({
            where: { organizationId },
            select: {
              user: {
                select: {
                  name: true,
                },
              },
              role: true,
              userId: true,
            },
          });

          const members = membersData.map((member) => {
            return {
              id: member.userId,
              name: member.user?.name || "",
              role: member.role,
            };
          });

          return members;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getMembersByOrganizationId-${organizationId}`],
      {
        tags: [membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);
