import "server-only";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { validateInputs } from "@/lib/utils/validate";
import { TOrganizationMember } from "@/modules/ee/teams/team-list/types/team";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { TMember, TMembership } from "@formbricks/types/memberships";

export const getMembershipByOrganizationId = reactCache(
  async (organizationId: string, page?: number): Promise<TMember[]> => {
    validateInputs([organizationId, ZString], [page, ZOptionalNumber]);

    try {
      const membersData = await prisma.membership.findMany({
        where: { organizationId },
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
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
          name: member.user ? `${member.user.firstName} ${member.user.lastName}` : "",
          email: member.user?.email || "",
          userId: member.userId,
          accepted: member.accepted,
          role: member.role,
          isActive: member.user?.isActive || false,
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
  }
);

export const getOrganizationOwnerCount = reactCache(async (organizationId: string): Promise<number> => {
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
});

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

    return deletedTeamMemberships;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getMembershipsByUserId = reactCache(
  async (userId: string, page?: number): Promise<TMembership[]> => {
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
  }
);

export const getMembersByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationMember[]> => {
    validateInputs([organizationId, ZString]);

    try {
      const membersData = await prisma.membership.findMany({
        where: { organizationId },
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          role: true,
          userId: true,
        },
      });

      const members = membersData.map((member) => {
        return {
          id: member.userId,
          name: member.user ? `${member.user.firstName} ${member.user.lastName}` : "",
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
  }
);
