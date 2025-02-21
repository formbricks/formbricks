import { ActionClass } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { actionClassCache } from "@formbricks/lib/actionClass/cache";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { DatabaseError } from "@formbricks/types/errors";

export const getActionClasses = reactCache(
  async (environmentId: string): Promise<ActionClass[]> =>
    cache(
      async () => {
        validateInputs([environmentId, z.string().cuid2()]);

        try {
          return await prisma.actionClass.findMany({
            where: {
              environmentId: environmentId,
            },
            orderBy: {
              createdAt: "asc",
            },
          });
        } catch (error) {
          throw new DatabaseError(`Database error when fetching actions for environment ${environmentId}`);
        }
      },
      [`survey-lib-getActionClasses-${environmentId}`],
      {
        tags: [actionClassCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
