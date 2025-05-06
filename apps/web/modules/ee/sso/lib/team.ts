import "server-only";
import { cache } from "@/lib/cache";
import { teamCache } from "@/lib/cache/team";
import { DEFAULT_TEAM_ID } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { validateInputs } from "@/lib/utils/validate";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import { Organization, Team } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";

export const getOrganizationByTeamId = reactCache(
  async (teamId: string): Promise<Organization | null> =>
    cache(
      async () => {
        validateInputs([teamId, z.string().cuid2()]);

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
      },
      [`getOrganizationByTeamId-${teamId}`],
      {
        tags: [teamCache.tag.byId(teamId)],
      }
    )()
);

const getTeam = reactCache(
  async (teamId: string): Promise<Team> =>
    cache(
      async () => {
        try {
          const team = await prisma.team.findUnique({
            where: {
              id: teamId,
            },
          });

          if (!team) {
            throw new Error("Team not found");
          }

          return team;
        } catch (error) {
          logger.error(error, `Team not found ${teamId}`);
          throw error;
        }
      },
      [`getTeam-${teamId}`],
      {
        tags: [teamCache.tag.byId(teamId)],
      }
    )()
);

export const createDefaultTeamMembership = async (userId: string) => {
  try {
    const defaultTeamId = DEFAULT_TEAM_ID;

    if (!defaultTeamId) {
      logger.error("Default team ID not found");
      return;
    }

    const defaultTeam = await getTeam(defaultTeamId);

    if (!defaultTeam) {
      logger.error("Default team not found");
      return;
    }

    const organizationMembership = await getMembershipByUserIdOrganizationId(
      userId,
      defaultTeam.organizationId
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
      userId
    );
  } catch (error) {
    logger.error("Error creating default team membership", error);
  }
};
