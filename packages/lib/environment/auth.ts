import { cache } from "react";
import { prisma } from "@formbricks/database";
import { unstable_cache } from "next/cache";

export const hasUserEnvironmentAccess = cache(async (userId: string, environmentId: string) => {
  if (!userId) return false;
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
  if (environmentUsers.includes(userId)) {
    return true;
  }
  return false;
});

export const hasUserEnvironmentAccessCached = async (userId: string, environmentId: string) =>
  await unstable_cache(
    async () => {
      return await hasUserEnvironmentAccess(userId, environmentId);
    },
    [`${userId}-${environmentId}`],
    {
      revalidate: 5 * 60, // 5 minutes
    }
  )();
