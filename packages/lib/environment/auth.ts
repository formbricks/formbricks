import { prisma } from "@formbricks/database";
import { Session } from "next-auth";

export const hasUserEnvironmentAccess = async (user: Session["user"], environmentId: string) => {
  if (!user) return false;
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
  if (environmentUsers.includes(user.id)) {
    return true;
  }
  return false;
};
