import "server-only";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TTeam, TTeamBilling, TTeamUpdateInput, ZTeamUpdateInput } from "@formbricks/types/teams";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { environmentCache } from "../environment/cache";
import { getProducts } from "../product/service";
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

export const getTeam = async (teamId: string): Promise<TTeam | null> =>
  unstable_cache(
    async () => {
      validateInputs([teamId, ZString]);

      try {
        const team = await prisma.team.findUnique({
          where: {
            id: teamId,
          },
          select,
        });

        return team;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getTeam-${teamId}`],
    {
      tags: [teamCache.tag.byId(teamId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const createTeam = async (teamInput: TTeamUpdateInput): Promise<TTeam> => {
  try {
    validateInputs([teamInput, ZTeamUpdateInput]);

    const team = await prisma.team.create({
      data: teamInput,
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
  const teams = await unstable_cache(
    async () => {
      try {
        const fetchedTeams = await prisma.team.findMany({
          where: {
            OR: [
              {
                billing: {
                  path: ["features", "inAppSurvey", "status"],
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
          select,
        });

        return fetchedTeams;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    ["getTeamsWithPaidPlan"],
    {
      tags: [],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return teams;
};

export const getMonthlyActiveTeamPeopleCount = async (teamId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      validateInputs([teamId, ZId]);

      // Define the start of the month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all environment IDs for the team
      const products = await getProducts(teamId);
      const environmentIds = products.flatMap((product) => product.environments.map((env) => env.id));

      // Aggregate the count of active people across all environments
      const peopleAggregations = await prisma.person.aggregate({
        _count: {
          id: true,
        },
        where: {
          AND: [
            { environmentId: { in: environmentIds } },
            {
              actions: {
                some: {
                  createdAt: { gte: firstDayOfMonth },
                },
              },
            },
          ],
        },
      });

      return peopleAggregations._count.id;
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

      // Define the start of the month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all environment IDs for the team
      const products = await getProducts(teamId);
      const environmentIds = products.flatMap((product) => product.environments.map((env) => env.id));

      // Use Prisma's aggregate to count responses for all environments
      const responseAggregations = await prisma.response.aggregate({
        _count: {
          id: true,
        },
        where: {
          AND: [
            { survey: { environmentId: { in: environmentIds } } },
            { survey: { type: "web" } },
            { createdAt: { gte: firstDayOfMonth } },
          ],
        },
      });

      // The result is an aggregation of the total count
      return responseAggregations._count.id;
    },
    [`getMonthlyTeamResponseCount-${teamId}`],
    {
      tags: [],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getTeamBillingInfo = async (teamId: string): Promise<TTeamBilling | null> =>
  await unstable_cache(
    async () => {
      const billingInfo = await prisma.team.findUnique({
        where: {
          id: teamId,
        },
      });

      return billingInfo?.billing ?? null;
    },
    [`getTeamBillingInfo-${teamId}`],
    {
      revalidate: SERVICES_REVALIDATION_INTERVAL,
      tags: [teamCache.tag.byId(teamId)],
    }
  )();
