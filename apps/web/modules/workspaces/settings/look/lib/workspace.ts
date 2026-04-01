import { Prisma, Workspace } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getWorkspaceByEnvironmentId = reactCache(
  async (environmentId: string): Promise<Workspace | null> => {
    validateInputs([environmentId, z.cuid2()]);

    let workspacePrisma;

    try {
      workspacePrisma = await prisma.workspace.findFirst({
        where: {
          environments: {
            some: {
              id: environmentId,
            },
          },
        },
      });

      return workspacePrisma;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error fetching workspace by environment id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
