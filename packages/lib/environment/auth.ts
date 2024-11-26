import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { organizationCache } from "../organization/cache";
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
                organization: {
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

        const environmentUsers =
          environment?.product.organization.memberships.map((member) => member.userId) || [];
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
      tags: [organizationCache.tag.byEnvironmentId(environmentId), organizationCache.tag.byUserId(userId)],
    }
  )();
