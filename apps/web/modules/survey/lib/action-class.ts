import { validateInputs } from "@/lib/utils/validate";
import { ActionClass } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

export const getActionClasses = reactCache(async (environmentId: string): Promise<ActionClass[]> => {
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
});
