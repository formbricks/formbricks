import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { getAccessFlags } from "@/lib/membership/utils";
import { CreateMembershipInvite } from "@/modules/auth/signup/types/invites";

type TTeamDbClient = PrismaClient | Prisma.TransactionClient;

const getDbClient = (tx?: Prisma.TransactionClient): TTeamDbClient => tx ?? prisma;

export const createTeamMembership = async (
  invite: CreateMembershipInvite,
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<void> => {
  const teamIds = invite.teamIds || [];

  const userMembershipRole = invite.role;
  const { isOwner, isManager } = getAccessFlags(userMembershipRole);

  const isOwnerOrManager = isOwner || isManager;
  try {
    const prismaClient = getDbClient(tx);
    for (const teamId of teamIds) {
      const team = await getTeamProjectIds(teamId, invite.organizationId, tx);

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
    }
  } catch (error) {
    logger.error(error, `Error creating team membership ${invite.organizationId} ${userId}`);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getTeamProjectIds = reactCache(
  async (
    teamId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ projectTeams: { projectId: string }[] } | null> => {
    const team = await getDbClient(tx).team.findUnique({
      where: {
        id: teamId,
        organizationId,
      },
      select: {
        projectTeams: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!team) {
      return null;
    }

    return team;
  }
);
