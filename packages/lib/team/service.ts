import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { TTeam, TTeamUpdateInput, ZTeamUpdateInput } from "@formbricks/types/v1/teams";
import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL, ITEMS_PER_PAGE } from "../constants";
import { getEnvironmentCacheTag } from "../environment/service";
import { ZOptionalNumber, ZString } from "@formbricks/types/v1/common";
import { validateInputs } from "../utils/validate";

export const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  plan: true,
  stripeCustomerId: true,
};

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
          throw new DatabaseError("Database operation failed");
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

        return team;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
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

export const createTeam = async (teamInput: TTeamUpdateInput): Promise<TTeam> => {
  try {
    validateInputs([teamInput, ZTeamUpdateInput]);

    const team = await prisma.team.create({
      data: teamInput,
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
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
