import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getEnvironmentIdsByOrganizationId = reactCache(
  async (organizationId: string): Promise<string[]> => {
    validateInputs([organizationId, ZId]);

    try {
      const environments = await prisma.environment.findMany({
        where: {
          project: {
            organizationId,
          },
        },
        select: {
          id: true,
        },
      });

      return environments.map((environment) => environment.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
