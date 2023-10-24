import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TTeam, TTeamUpdateInput, ZTeamUpdateInput } from "@formbricks/types/teams";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL, ITEMS_PER_PAGE } from "../constants";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { validateInputs } from "../utils/validate";
import { environmentCache } from "../environment/cache";
import { teamCache } from "./cache";

export const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  plan: true,
  stripeCustomerId: true,
};

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

        teamCache.revalidate({
          userId,
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

        teamCache.revalidate({
          environmentId,
        });

        return team;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error.message);
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
