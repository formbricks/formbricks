"use server";

import { TOrganizationTeam } from "@/app/(app)/(onboarding)/types/onboarding";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getTeamsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationTeam[] | null> => {
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

      const projectTeams = teams.map((team) => ({
        id: team.id,
        name: team.name,
      }));

      return projectTeams;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
