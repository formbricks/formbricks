import "server-only";
import { teamCache } from "@/lib/cache/team";
import { TTeamPermission } from "@/modules/ee/teams/team-access/types/teams";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";

export const getProductPermissionByUserId = reactCache(
  (userId: string, productId: string): Promise<TTeamPermission | null> =>
    cache(
      async () => {
        validateInputs([userId, ZString], [productId, ZString]);

        try {
          const productMemberships = await prisma.productTeam.findMany({
            where: {
              productId: productId,
              team: {
                teamMembers: {
                  some: {
                    userId,
                  },
                },
              },
            },
          });

          if (!productMemberships) return null;
          let highestPermission: TTeamPermission = "read";

          for (const membership of productMemberships) {
            if (membership.permission === "manage") {
              highestPermission = "manage";
            } else if (membership.permission === "readWrite" && highestPermission !== "manage") {
              highestPermission = "readWrite";
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
