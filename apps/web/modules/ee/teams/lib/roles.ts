import "server-only";
import { teamCache } from "@/lib/cache/team";
import { TTeamPermission } from "@/modules/ee/teams/product-teams/types/teams";
import { TTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { membershipCache } from "@formbricks/lib/membership/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";

export const getProductPermissionByUserId = reactCache(
  async (userId: string, productId: string): Promise<TTeamPermission | null> =>
    cache(
      async () => {
        validateInputs([userId, ZString], [productId, ZString]);

        try {
          const productMemberships = await prisma.productTeam.findMany({
            where: {
              productId,
              team: {
                teamUsers: {
                  some: {
                    userId,
                  },
                },
              },
            },
          });

          if (!productMemberships) return null;
          let highestPermission: TTeamPermission | null = null;

          for (const membership of productMemberships) {
            if (membership.permission === "manage") {
              highestPermission = "manage";
            } else if (membership.permission === "readWrite" && highestPermission !== "manage") {
              highestPermission = "readWrite";
            } else if (
              membership.permission === "read" &&
              highestPermission !== "manage" &&
              highestPermission !== "readWrite"
            ) {
              highestPermission = "read";
            }
          }

          return highestPermission;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }

          throw new UnknownError("Error while fetching membership");
        }
      },
      [`getProductPermissionByUserId-${userId}-${productId}`],
      {
        tags: [teamCache.tag.byUserId(userId), teamCache.tag.byProductId(productId)],
      }
    )()
);

export const getTeamRoleByTeamIdUserId = reactCache(
  async (teamId: string, userId: string): Promise<TTeamRole | null> =>
    cache(
      async () => {
        validateInputs([teamId, ZId], [userId, ZId]);
        try {
          const teamUser = await prisma.teamUser.findUnique({
            where: {
              teamId_userId: {
                teamId,
                userId,
              },
            },
          });

          if (!teamUser) {
            return null;
          }

          return teamUser.role;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeamMembershipByTeamIdUserId-${teamId}-${userId}`],
      {
        tags: [teamCache.tag.byId(teamId), membershipCache.tag.byUserId(userId)],
      }
    )()
);
