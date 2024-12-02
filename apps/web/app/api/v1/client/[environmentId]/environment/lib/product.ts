import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { productCache } from "@formbricks/lib/product/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TJsEnvironmentStateProduct } from "@formbricks/types/js";

export const getProductForEnvironmentState = reactCache(
  async (environmentId: string): Promise<TJsEnvironmentStateProduct | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          return await prisma.product.findFirst({
            where: {
              environments: {
                some: {
                  id: environmentId,
                },
              },
            },
            select: {
              id: true,
              recontactDays: true,
              clickOutsideClose: true,
              darkOverlay: true,
              placement: true,
              inAppSurveyBranding: true,
              styling: true,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getProductForEnvironmentState-${environmentId}`],
      {
        tags: [productCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
