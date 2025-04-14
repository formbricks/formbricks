import "server-only";
import { teamCache } from "@/lib/cache/team";
import { Organization } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
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
