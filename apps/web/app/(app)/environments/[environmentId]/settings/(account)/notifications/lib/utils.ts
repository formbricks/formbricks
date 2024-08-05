import "server-only";
import { Membership } from "@/app/(app)/environments/[environmentId]/settings/(account)/notifications/types";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { membershipCache } from "@formbricks/lib/membership/cache";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { productCache } from "@formbricks/lib/product/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";

export const getMembershipsForNotification = async (
  userId: string,
  environmentIds: string[]
): Promise<Membership[]> =>
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
    [`getMembershipsForNotification-${userId}`],
    {
      tags: [
        membershipCache.tag.byUserId(userId),
        productCache.tag.byUserId(userId),
        organizationCache.tag.byUserId(userId),
        ...environmentIds.map((environmentId) => surveyCache.tag.byEnvironmentId(environmentId)),
      ],
    }
  )();
