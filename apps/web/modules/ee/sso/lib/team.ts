import "server-only";
import { Organization, Prisma, PrismaClient, Team } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { DEFAULT_TEAM_ID } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { validateInputs } from "@/lib/utils/validate";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";

type TSsoTeamDbClient = PrismaClient | Prisma.TransactionClient;

const getDbClient = (tx?: Prisma.TransactionClient): TSsoTeamDbClient => tx ?? prisma;

export const getOrganizationByTeamId = reactCache(async (teamId: string): Promise<Organization | null> => {
  validateInputs([teamId, z.cuid2()]);

  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        organization: true,
      },
    });

    if (!team) {
      return null;
    }
    return team.organization;
  } catch (error) {
    logger.error(error, `Error getting organization by team id ${teamId}`);
    return null;
  }
});

const getTeam = reactCache(async (teamId: string): Promise<Team> => {
  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!team) {
      throw new ResourceNotFoundError("Team", teamId);
    }

    return team;
  } catch (error) {
    logger.error(error, `Team not found ${teamId}`);
    throw error;
  }
});

export const createDefaultTeamMembership = async (userId: string, tx?: Prisma.TransactionClient) => {
  try {
    const prismaClient = getDbClient(tx);
    const defaultTeamId = DEFAULT_TEAM_ID;

    if (!defaultTeamId) {
      logger.error("Default team ID not found");
      return;
    }

    const defaultTeam = tx
      ? await prismaClient.team.findUnique({
          where: {
            id: defaultTeamId,
          },
        })
      : await getTeam(defaultTeamId);

    if (!defaultTeam) {
      logger.error("Default team not found");
      return;
    }

    const organizationMembership = await getMembershipByUserIdOrganizationId(
      userId,
      defaultTeam.organizationId,
      tx
    );

    if (!organizationMembership) {
      logger.error("Organization membership not found");
      return;
    }

    const membershipRole = organizationMembership.role;

    await createTeamMembership(
      {
        organizationId: defaultTeam.organizationId,
        role: membershipRole,
        teamIds: [defaultTeamId],
      },
      userId,
      tx
    );
  } catch (error) {
    logger.error(
      error instanceof Error ? error : new Error(String(error)),
      "Error creating default team membership"
    );
  }
};
