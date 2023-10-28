import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TTeam, TTeamUpdateInput, ZTeamUpdateInput } from "@formbricks/types/teams";
import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL, ITEMS_PER_PAGE } from "../constants";
import { getEnvironmentCacheTag } from "../environment/service";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { validateInputs } from "../utils/validate";

export const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  billing: true,
};

export const getTeamsTag = (teamId: string) => `teams-${teamId}`;
export const getTeamsByUserIdCacheTag = (userId: string) => `users-${userId}-teams`;
export const getTeamByEnvironmentIdCacheTag = (environmentId: string) => `environments-${environmentId}-team`;

export const getTeamsByUserId = async (userId: string, page?: number): Promise<TTeam[]> =>
  unstable_cache(
    async () => {
      validateInputs([userId, ZString], [page, ZOptionalNumber]);

      try {
        const teams = await prisma.team.findMany({
          where: {
            memberships: {
              some: {
                userId,
              },
            },
          },
          select,
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });
        revalidateTag(getTeamsByUserIdCacheTag(userId));

        return teams;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`users-${userId}-teams`],
    {
      tags: [getTeamsByUserIdCacheTag(userId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getTeamByEnvironmentId = async (environmentId: string): Promise<TTeam | null> =>
  unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);

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
          select: { ...select, memberships: true }, // include memberships
        });
        revalidateTag(getTeamByEnvironmentIdCacheTag(environmentId));

        return team;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`environments-${environmentId}-team`],
    {
      tags: [getTeamByEnvironmentIdCacheTag(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getTeam = async (teamId: string): Promise<TTeam> =>
  unstable_cache(
    async () => {
      validateInputs([teamId, ZString]);

      try {
        const team = await prisma.team.findFirstOrThrow({
          where: {
            id: teamId,
          },
          select: { ...select, products: { select: { environments: true } } }, // include environments
        });

        return team;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`teams-${teamId}`],
    {
      tags: [getTeamsTag(teamId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const createTeam = async (teamInput: TTeamUpdateInput): Promise<TTeam> => {
  try {
    validateInputs([teamInput, ZTeamUpdateInput]);

    const team = await prisma.team.create({
      data: {
        name: teamInput.name,
      },
      select,
    });

    return team;
  } catch (error) {
    throw error;
  }
};

export const updateTeam = async (teamId: string, data: Partial<TTeamUpdateInput>): Promise<TTeam> => {
  try {
    const updatedTeam = await prisma.team.update({
      where: {
        id: teamId,
      },
      data,
      select: { ...select, memberships: true, products: { select: { environments: true } } }, // include memberships & environments
    });

    // revalidate cache for members
    updatedTeam?.memberships.forEach((membership) => {
      revalidateTag(getTeamsByUserIdCacheTag(membership.userId));
    });

    // revalidate cache for environments
    updatedTeam?.products.forEach((product) => {
      product.environments.forEach((environment) => {
        revalidateTag(getTeamByEnvironmentIdCacheTag(environment.id));
      });
    });

    const team = {
      ...updatedTeam,
      memberships: undefined,
      products: undefined,
    };

    return team;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Team", teamId);
    } else {
      throw error; // Re-throw any other errors
    }
  }
};

export const deleteTeam = async (teamId: string): Promise<TTeam> => {
  validateInputs([teamId, ZId]);
  try {
    const deletedTeam = await prisma.team.delete({
      where: {
        id: teamId,
      },
      select: { ...select, memberships: true, products: { select: { environments: true } } }, // include memberships & environments
    });

    // revalidate cache for members
    deletedTeam?.memberships.forEach((membership) => {
      revalidateTag(getTeamsByUserIdCacheTag(membership.userId));
    });

    // revalidate cache for environments
    deletedTeam?.products.forEach((product) => {
      product.environments.forEach((environment) => {
        revalidateTag(getTeamByEnvironmentIdCacheTag(environment.id));
        revalidateTag(getEnvironmentCacheTag(environment.id));
      });
    });

    const team = {
      ...deletedTeam,
      memberships: undefined,
      products: undefined,
    };

    return team;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getTeamsWithPaidPlan = async (): Promise<TTeam[]> => {
  try {
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          {
            billing: {
              path: ["features", "appSurvey", "status"],
              not: "inactive",
            },
          },
          {
            billing: {
              path: ["features", "userTargeting", "status"],
              not: "inactive",
            },
          },
        ],
      },
      select: { ...select, products: { select: { environments: true } } }, // include environments
    });

    return teams;
  } catch (error) {
    throw error;
  }
};
