import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TOrganizationFeedbackRecordDirectory } from "@/modules/organization/settings/api-keys/types/api-keys";

export const getFeedbackRecordDirectoriesByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationFeedbackRecordDirectory[]> => {
    try {
      const directories = await prisma.feedbackRecordDirectory.findMany({
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
