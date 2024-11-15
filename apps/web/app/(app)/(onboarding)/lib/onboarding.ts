"use server";

import { TOrganizationTeam } from "@/app/(app)/(onboarding)/types/onboarding";
import { teamCache } from "@/lib/cache/team";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getTeamsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationTeam[] | null> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId]);
        try {
          const teams = await prisma.team.findMany({
            where: {
              organizationId,
            },
            select: {
              id: true,
              name: true,
            },
          });

          const productTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
          }));

          return productTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeamsByOrganizationId-${organizationId}`],
      {
        tags: [teamCache.tag.byOrganizationId(organizationId)],
      }
    )()
);
