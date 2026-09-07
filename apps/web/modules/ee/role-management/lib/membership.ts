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
  data: TMembershipUpdateInput,
  tx?: Prisma.TransactionClient
): Promise<TMembership> => {
  validateInputs([userId, ZString], [organizationId, ZString], [data, ZMembershipUpdateInput]);
  const client = tx ?? prisma;
  let affectedTeamIds: string[] = [];
  let membershipUpdated = false;

  try {
    const membership = await client.membership.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      data,
    });
    membershipUpdated = true;

    if (data.role === "owner" || data.role === "manager") {
      await client.teamUser.updateMany({
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

    const teamMemberships = await client.teamUser.findMany({
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

    await client.membership.findMany({
      where: {
        organizationId,
      },
      select: {
        userId: true,
      },
    });

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
    // A transaction-scoped call is projected by the durable PostgreSQL outbox only after the outer
    // transaction commits. Reading through the global client here could observe the pre-commit role
    // and would publish stale relationships.
    if (!tx && membershipUpdated) {
      await runPostCommitProjection("organization_role_membership_update", () =>
        reconcileOrganizationMembership(organizationId, userId)
      );
      await runPostCommitProjection("organization_role_team_membership_update", () =>
        reconcileTeamWorkspaceRelationships({
          teamMemberships: affectedTeamIds.map((teamId) => ({ teamId, userId })),
        })
      );
    }
  }
};
