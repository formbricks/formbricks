import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZString } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TMembership, TMembershipUpdateInput, ZMembershipUpdateInput } from "@formbricks/types/memberships";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { validateInputs } from "@/lib/utils/validate";

export const updateMembership = async (
  userId: string,
  organizationId: string,
  data: TMembershipUpdateInput
): Promise<TMembership> => {
  validateInputs([userId, ZString], [organizationId, ZString], [data, ZMembershipUpdateInput]);
  let affectedTeamIds: string[] = [];

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

    await reconcileOrganizationMembership(organizationId, userId);

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
    affectedTeamIds = teamMemberships.map(({ teamId }) => teamId);

    return membership;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === PrismaErrorType.RelatedRecordNotFound || error.code === PrismaErrorType.RecordNotFound)
    ) {
      throw new ResourceNotFoundError("Membership", `userId: ${userId}, organizationId: ${organizationId}`);
    }

    throw error;
  } finally {
    await runPostCommitProjection("organization_role_team_membership_update", () =>
      reconcileTeamWorkspaceRelationships({
        teamMemberships: affectedTeamIds.map((teamId) => ({ teamId, userId })),
      })
    );
  }
};
