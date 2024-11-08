import "server-only";
import { teamCache } from "@/lib/cache/team";
import {
  TOrganizationTeam,
  TProductTeam,
  TTeamPermission,
  ZTeamPermission,
} from "@/modules/ee/teams/product-teams/types/teams";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { productCache } from "@formbricks/lib/product/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getTeamsByProductId = reactCache(
  (productId: string): Promise<TProductTeam[] | null> =>
    cache(
      async () => {
        validateInputs([productId, ZId]);
        try {
          const product = await prisma.product.findUnique({
            where: {
              id: productId,
            },
          });

          if (!product) {
            throw new ResourceNotFoundError("Product", productId);
          }

          const teams = await prisma.team.findMany({
            where: {
              productTeams: {
                some: {
                  productId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              productTeams: {
                where: {
                  productId,
                },
                select: {
                  permission: true,
                },
              },
              _count: {
                select: {
                  teamUsers: true,
                },
              },
            },
          });

          const productTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
            permission: team.productTeams[0].permission,
            memberCount: team._count.teamUsers,
          }));

          return productTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeamsByProductId-${productId}`],
      {
        tags: [teamCache.tag.byProductId(productId), productCache.tag.byId(productId)],
      }
    )()
);

export const removeTeamAccess = async (productId: string, teamId: string): Promise<boolean> => {
  validateInputs([productId, ZId], [teamId, ZId]);
  try {
    const productMembership = await prisma.productTeam.findFirst({
      where: {
        productId,
        teamId,
      },
    });

    if (!productMembership) {
      throw new AuthorizationError("Team does not have access to this product");
    }

    await prisma.productTeam.deleteMany({
      where: {
        productId,
        teamId,
      },
    });

    teamCache.revalidate({
      id: teamId,
      productId,
    });
    productCache.revalidate({
      id: productId,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const addTeamAccess = async (productId: string, teamIds: string[]): Promise<boolean> => {
  validateInputs([productId, ZId], [teamIds, z.array(ZId)]);
  try {
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new ResourceNotFoundError("Product", productId);
    }

    for (let teamId of teamIds) {
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          organizationId: product.organizationId,
        },
      });

      if (!team) {
        throw new ResourceNotFoundError("Team", teamId);
      }

      const productTeam = await prisma.productTeam.findFirst({
        where: {
          productId,
          teamId,
        },
      });

      if (productTeam) {
        throw new AuthorizationError("Teams already have access to this product");
      }

      await prisma.productTeam.create({
        data: {
          productId,
          teamId,
        },
      });
    }

    teamCache.revalidate({
      productId,
    });
    productCache.revalidate({
      id: productId,
    });

    teamIds.forEach((teamId) => {
      teamCache.revalidate({
        id: teamId,
      });
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getTeamsByOrganizationId = reactCache(
  (organizationId: string): Promise<TOrganizationTeam[] | null> =>
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

export const updateTeamAccessPermission = async (
  productId: string,
  teamId: string,
  permission: TTeamPermission
): Promise<boolean> => {
  validateInputs([productId, ZId], [teamId, ZId], [permission, ZTeamPermission]);
  try {
    const productMembership = await prisma.productTeam.findUniqueOrThrow({
      where: {
        productId_teamId: {
          productId,
          teamId,
        },
      },
    });

    if (!productMembership) {
      throw new AuthorizationError("Team does not have access to this product");
    }

    await prisma.productTeam.update({
      where: {
        productId_teamId: {
          productId,
          teamId,
        },
      },
      data: {
        permission,
      },
    });

    teamCache.revalidate({
      id: teamId,
      productId,
    });

    productCache.revalidate({
      id: productId,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
