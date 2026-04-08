import { Prisma, Workspace } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getWorkspaceById = reactCache(async (workspaceId: string): Promise<Workspace | null> => {
  validateInputs([workspaceId, z.cuid2()]);

  try {
    const workspacePrisma = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    return workspacePrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error fetching workspace by id");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});
