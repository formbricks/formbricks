import "server-only";
import { membershipCache } from "@/lib/cache/membership";
import { teamCache } from "@/lib/cache/team";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/src/types/error";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
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

    const teamMemberships = await prisma.teamUser.findMany({
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

    if (data.role === "owner" || data.role === "manager") {
      await prisma.teamUser.updateMany({
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

    const organizationMembers = await prisma.membership.findMany({
      where: {
        organizationId,
      },
      select: {
        userId: true,
      },
    });

    teamCache.revalidate({
      userId,
      organizationId,
    });

    teamMemberships.forEach((teamMembership) => {
      teamCache.revalidate({
        id: teamMembership.teamId,
      });
    });

    organizationMembers.forEach((member) => {
      organizationCache.revalidate({
        userId: member.userId,
      });
    });

    membershipCache.revalidate({
      userId,
      organizationId,
    });

    projectCache.revalidate({
      userId,
    });

    return membership;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("Membership", `userId: ${userId}, organizationId: ${organizationId}`);
    }

    throw error;
  }
};
