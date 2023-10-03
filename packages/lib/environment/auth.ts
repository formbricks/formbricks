import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { unstable_cache } from "next/cache";
import { validateInputs } from "../utils/validate";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

export const hasUserEnvironmentAccess = async (userId: string, environmentId: string) => {
  return await unstable_cache(
    async () => {
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
      const environmentUsers = environment?.product.team.memberships.map((member) => member.userId) || [];
      return environmentUsers.includes(userId);
    },
    [`users-${userId}-environments-${environmentId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [`environments-${environmentId}`] }
  )();
};
