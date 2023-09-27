import { prisma } from "@formbricks/database";
import { TTag } from "@formbricks/types/v1/tags";
import { cache } from "react";

export const getTagsByEnvironmentId = cache(async (environmentId: string): Promise<TTag[]> => {
  try {
    const tags = await prisma.tag.findMany({
      where: {
        environmentId,
      },
    });

    return tags;
  } catch (error) {
    throw error;
  }
});
