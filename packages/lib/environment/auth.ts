import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { unstable_cache } from "next/cache";
import { validateInputs } from "../utils/validate";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { teamCache } from "../team/cache";

export const hasUserEnvironmentAccess = async (userId: string, environmentId: string) => {
  return await unstable_cache(
    async (): Promise<boolean> => {
      validateInputs([userId, ZId], [environmentId, ZId]);

      const environment = await prisma.environment.findUnique({
        where: {
          id: environmentId,
        },
        select: {
          product: {
            select: {
              team: {
                select: {
                  memberships: {
                    select: {
                      userId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      teamCache.revalidate({
        userId,
      });

      const environmentUsers = environment?.product.team.memberships.map((member) => member.userId) || [];
      return environmentUsers.includes(userId);
    },
    [`hasUserEnvironmentAccess-${userId}-${environmentId}`],
    {
      revalidate: SERVICES_REVALIDATION_INTERVAL,
      tags: [teamCache.tag.byEnvironmentId(environmentId), teamCache.tag.byUserId(userId)],
    }
  )();
};
