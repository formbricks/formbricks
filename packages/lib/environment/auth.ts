import { prisma } from "@formbricks/database";
import { unstable_cache } from "next/cache";

export const hasUserEnvironmentAccess = async (userId: string, environmentId: string) => {
  return await unstable_cache(
    async () => {
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
      return environmentUsers.includes(userId);
    },
    [`users-${userId}-environments-${environmentId}`],
    { revalidate: 30 * 60, tags: [`environments-${environmentId}`] }
  )(); // 30 minutes
};
