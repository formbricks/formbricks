import "server-only";
import { membershipCache } from "@/lib/cache/membership";
import { teamCache } from "@/lib/cache/team";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError, UnknownError } from "@formbricks/types/errors";
import { TMembership, TMembershipUpdateInput, ZMembershipUpdateInput } from "@formbricks/types/memberships";

export const updateMembership = async (
  userId: string,
  organizationId: string,
  data: TMembershipUpdateInput
): Promise<TMembership> => {
  validateInputs([userId, ZString], [organizationId, ZString], [data, ZMembershipUpdateInput]);

  try {
    const membership = await prisma.membership.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      data,
    });

    const teamMemberships = await prisma.teamMembership.findMany({
      where: {
        userId,
        team: {
          organizationId,
        },
      },
      select: {
        teamId: true,
      },
    });

    if (data.organizationRole === "owner" || data.organizationRole === "manager") {
      await prisma.teamMembership.updateMany({
        where: {
          userId,
          team: {
            organizationId,
          },
        },
        data: {
          role: "admin",
        },
      });
    }

    teamCache.revalidate({
      userId,
      organizationId,
    });

    teamMemberships.forEach((teamMembership) => {
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

    return membership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Membership", `userId: ${userId}, organizationId: ${organizationId}`);
    }

    throw error;
  }
};

export const transferOwnership = async (
  currentOwnerId: string,
  newOwnerId: string,
  organizationId: string
): Promise<TMembership[]> => {
  validateInputs([currentOwnerId, ZString], [newOwnerId, ZString], [organizationId, ZString]);

  try {
    const memberships = await prisma.$transaction([
      prisma.membership.update({
        where: {
          userId_organizationId: {
            organizationId,
            userId: currentOwnerId,
          },
        },
        data: {
          organizationRole: "manager",
        },
      }),
      prisma.membership.update({
        where: {
          userId_organizationId: {
            organizationId,
            userId: newOwnerId,
          },
        },
        data: {
          organizationRole: "owner",
        },
      }),
    ]);

    memberships.forEach((membership) => {
      organizationCache.revalidate({
        userId: membership.userId,
      });

      membershipCache.revalidate({
        userId: membership.userId,
        organizationId: membership.organizationId,
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
