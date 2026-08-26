import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { TMember, TMembership } from "@formbricks/types/memberships";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { validateInputs } from "@/lib/utils/validate";
import { TOrganizationMember } from "@/modules/ee/teams/team-list/types/team";

export const getMembershipByOrganizationId = reactCache(
  async (organizationId: string, page?: number): Promise<TMember[]> => {
    validateInputs([organizationId, ZString], [page, ZOptionalNumber]);

    try {
      const membersData = await prisma.membership.findMany({
        where: { organizationId },
        select: {
          user: {
            select: {
              name: true,
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
          name: member.user?.name || "",
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

const getOrganizationOwnerCountUncached = async (
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<number> => {
  validateInputs([organizationId, ZString]);

  try {
    const ownersCount = await (tx ?? prisma).membership.count({
      where: {
        organizationId,
        role: "owner",
        // A deactivated user can never sign in again (see modules/auth/lib/session.ts and
        // better-auth-active-user-gate.ts), so counting them as "another owner" would let a
        // guard pass while leaving the organization with no owner who can actually log in.
        user: { isActive: true },
      },
    });

    return ownersCount;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

const getOrganizationOwnerCountCached = reactCache((organizationId: string) =>
  getOrganizationOwnerCountUncached(organizationId)
);

/**
 * Pass `tx` when this must be read inside the same transaction as the mutation it's guarding
 * (see updateMembershipAction) so a Serializable transaction can catch concurrent demotions;
 * without `tx` the result is request-cached like the rest of this module's reads.
 */
export const getOrganizationOwnerCount = async (
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<number> => {
  if (tx) {
    return getOrganizationOwnerCountUncached(organizationId, tx);
  }

  return getOrganizationOwnerCountCached(organizationId);
};

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
  }
);
