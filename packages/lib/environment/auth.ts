import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";

import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { teamCache } from "../team/cache";
import { validateInputs } from "../utils/validate";

export const hasUserEnvironmentAccess = async (userId: string, environmentId: string) => {
  return await unstable_cache(
    async (): Promise<boolean> => {
      validateInputs([userId, ZId], [environmentId, ZId]);

      try {
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

        const environmentUsers = environment?.product.team.memberships.map((member) => member.userId) || [];
        return environmentUsers.includes(userId);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    [`hasUserEnvironmentAccess-${userId}-${environmentId}`],
    {
      revalidate: SERVICES_REVALIDATION_INTERVAL,
      tags: [teamCache.tag.byEnvironmentId(environmentId), teamCache.tag.byUserId(userId)],
    }
  )();
};
