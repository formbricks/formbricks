import { Prisma } from "@prisma/client";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";

import { cache } from "../cache";
import { teamCache } from "../team/cache";
import { validateInputs } from "../utils/validate";

export const hasUserEnvironmentAccess = async (userId: string, environmentId: string) =>
  cache(
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
      tags: [teamCache.tag.byEnvironmentId(environmentId), teamCache.tag.byUserId(userId)],
    }
  )();
