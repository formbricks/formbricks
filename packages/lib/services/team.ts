import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { TTeam } from "@formbricks/types/v1/teams";
import { Prisma } from "@prisma/client";
import { cache } from "react";

export const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  plan: true,
};

export const getTeamByEnvironmentId = cache(async (environmentId: string): Promise<TTeam | null> => {
  try {
    const team = await prisma.team.findFirst({
      where: {
        products: {
          some: {
            environments: {
              some: {
                id: environmentId,
              },
            },
          },
        },
      },
      select,
    });

    return team;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});
