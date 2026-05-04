import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TOrganizationFeedbackDirectory } from "@/modules/organization/settings/api-keys/types/api-keys";

export const getFeedbackDirectoriesByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationFeedbackDirectory[]> => {
    try {
      const directories = await prisma.feedbackDirectory.findMany({
        where: {
          organizationId,
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return directories;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
