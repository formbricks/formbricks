import "server-only";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TTeam, TTeamUpdateInput, ZTeamUpdateInput } from "@formbricks/types/teams";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getMonthlyActivePeopleCount } from "../person/service";
import { getProducts } from "../product/service";
import { getMonthlyResponseCount } from "../response/service";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { environmentCache } from "../environment/cache";
import { validateInputs } from "../utils/validate";
import { teamCache } from "./cache";

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

        return teams;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getTeamsByUserId-${userId}-${page}`],
    {
      tags: [teamCache.tag.byUserId(userId)],
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

        return team;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getTeamByEnvironmentId-${environmentId}`],
    {
      tags: [teamCache.tag.byEnvironmentId(environmentId)],
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

    teamCache.revalidate({
      id: team.id,
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
      teamCache.revalidate({
        userId: membership.userId,
      });
    });

    // revalidate cache for environments
    updatedTeam?.products.forEach((product) => {
      product.environments.forEach((environment) => {
        teamCache.revalidate({
          environmentId: environment.id,
        });
      });
    });

    const team = {
      ...updatedTeam,
      memberships: undefined,
      products: undefined,
    };

    teamCache.revalidate({
      id: team.id,
    });

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
      teamCache.revalidate({
        userId: membership.userId,
      });
    });

    // revalidate cache for environments
    deletedTeam?.products.forEach((product) => {
      product.environments.forEach((environment) => {
        environmentCache.revalidate({
          id: environment.id,
        });

        teamCache.revalidate({
          environmentId: environment.id,
        });
      });
    });

    const team = {
      ...deletedTeam,
      memberships: undefined,
      products: undefined,
    };

    teamCache.revalidate({
      id: team.id,
    });

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

export const getMonthlyActiveTeamPeopleCount = async (teamId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      validateInputs([teamId, ZId]);

      const products = await getProducts(teamId);

      let peopleCount = 0;

      for (const product of products) {
        for (const environment of product.environments) {
          const peopleInThisEnvironment = await getMonthlyActivePeopleCount(environment.id);

          peopleCount += peopleInThisEnvironment;
        }
      }

      return peopleCount;
    },
    [`getMonthlyActiveTeamPeopleCount-${teamId}`],
    {
      tags: [],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getMonthlyTeamResponseCount = async (teamId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      validateInputs([teamId, ZId]);

      const products = await getProducts(teamId);

      let peopleCount = 0;

      for (const product of products) {
        for (const environment of product.environments) {
          const peopleInThisEnvironment = await getMonthlyResponseCount(environment.id);

          peopleCount += peopleInThisEnvironment;
        }
      }

      return peopleCount;
    },
    [`getMonthlyActiveTeamPeopleCount-${teamId}`],
    {
      tags: [],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
