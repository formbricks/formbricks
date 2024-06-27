import "server-only";
import { Membership } from "@/app/(app)/environments/[environmentId]/settings/(account)/notifications/types";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { membershipCache } from "@formbricks/lib/membership/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";

export const getMembershipsForNotification = async (userId: string): Promise<Membership[]> =>
  cache(
    async () => {
      validateInputs([userId, ZString]);

      try {
        const memberships = await prisma.membership.findMany({
          where: {
            userId,
          },
          select: {
            organization: {
              select: {
                id: true,
                name: true,
                products: {
                  select: {
                    id: true,
                    name: true,
                    environments: {
                      where: {
                        type: "production",
                      },
                      select: {
                        id: true,
                        surveys: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        return memberships;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw new UnknownError("Error while fetching members");
      }
    },
    [`getMembersForNotification-${userId}`],
    {
      tags: [membershipCache.tag.byUserId(userId)],
    }
  )();
