import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma, PrismaClient, Team } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { getAccessFlags } from "@/lib/membership/utils";
import { CreateMembershipInvite } from "@/modules/auth/signup/types/invites";

type TTeamDbClient = PrismaClient | Prisma.TransactionClient;
type TTeamMembershipTarget = Pick<Team, "id">;
type TDeferredTeamMembershipProjection = Readonly<{
  projection: "deferred";
  transaction: Prisma.TransactionClient;
}>;

const getDbClient = (tx?: Prisma.TransactionClient): TTeamDbClient => tx ?? prisma;

const getTeamForOrganizationUncached = async (
  teamId: string,
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<TTeamMembershipTarget | null> => {
  const team = await getDbClient(tx).team.findUnique({
    where: {
      id: teamId,
      organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!team) {
    return null;
  }

  return team;
};

const getTeamForOrganizationCached = reactCache(async (teamId: string, organizationId: string) =>
  getTeamForOrganizationUncached(teamId, organizationId)
);

export const createTeamMembership = async (
  invite: CreateMembershipInvite,
  userId: string,
  options?: TDeferredTeamMembershipProjection
): Promise<void> => {
  const teamIds = invite.teamIds || [];
  const committedTeamIds: string[] = [];

  const userMembershipRole = invite.role;
  const { isOwner, isManager } = getAccessFlags(userMembershipRole);

  const isOwnerOrManager = isOwner || isManager;
  try {
    const transaction = options?.transaction;
    const prismaClient = getDbClient(transaction);
    for (const teamId of teamIds) {
      const team = await getTeamForOrganization(teamId, invite.organizationId, transaction);

      if (!team) {
        logger.warn({ teamId, userId }, "Team no longer exists during invite acceptance");
        continue;
      }

      await prismaClient.teamUser.upsert({
        create: {
          teamId,
          userId,
          role: isOwnerOrManager ? "admin" : "contributor",
        },
        update: {
          role: isOwnerOrManager ? "admin" : "contributor",
        },
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });
      committedTeamIds.push(teamId);
    }
  } catch (error) {
    logger.error(error, `Error creating team membership ${invite.organizationId} ${userId}`);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  } finally {
    if (!options) {
      await runPostCommitProjection("signup_team_membership_create", () =>
        reconcileTeamWorkspaceRelationships({
          teamMemberships: committedTeamIds.map((teamId) => ({ teamId, userId })),
        })
      );
    }
  }
};

export const getTeamForOrganization = async (
  teamId: string,
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<TTeamMembershipTarget | null> => {
  if (tx) {
    return getTeamForOrganizationUncached(teamId, organizationId, tx);
  }

  return getTeamForOrganizationCached(teamId, organizationId);
};
