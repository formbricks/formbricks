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
        const orgMembership = await prisma.membership.findFirst({
          where: {
            userId,
            organization: {
              projects: {
                some: {
                  environments: {
                    some: {
                      id: environmentId,
                    },
                  },
                },
              },
            },
          },
        });

        if (!orgMembership) return false;

        if (
          orgMembership.role === "owner" ||
          orgMembership.role === "manager" ||
          orgMembership.role === "billing"
        )
          return true;

        const teamMembership = await prisma.teamUser.findFirst({
          where: {
            userId,
            team: {
              projectTeams: {
                some: {
                  project: {
                    environments: {
                      some: {
                        id: environmentId,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (teamMembership) return true;

        return false;
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
