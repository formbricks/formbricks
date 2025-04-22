"use server";

import "server-only";
import { actionClassCache } from "@/lib/actionClass/cache";
import { cache } from "@/lib/cache";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TActionClass } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

const selectActionClass = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  description: true,
  type: true,
  key: true,
  noCodeConfig: true,
  environmentId: true,
} satisfies Prisma.ActionClassSelect;

export const getActionClasses = reactCache(
  async (environmentIds: string[]): Promise<TActionClass[]> =>
    cache(
      async () => {
        validateInputs([environmentIds, ZId.array()]);

        try {
          return await prisma.actionClass.findMany({
            where: {
              environmentId: { in: environmentIds },
            },
            select: selectActionClass,
            orderBy: {
              createdAt: "asc",
            },
          });
        } catch (error) {
          throw new DatabaseError(`Database error when fetching actions for environment ${environmentIds}`);
        }
      },
      environmentIds.map((environmentId) => `getActionClasses-management-api-${environmentId}`),
      {
        tags: environmentIds.map((environmentId) => actionClassCache.tag.byEnvironmentId(environmentId)),
      }
    )()
);
