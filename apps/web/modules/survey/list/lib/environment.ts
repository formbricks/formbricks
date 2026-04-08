import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const doesWorkspaceExist = reactCache(async (workspaceId: string): Promise<string | null> => {
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      id: true,
    },
  });

  if (!workspace) {
    throw new ResourceNotFoundError("Workspace", workspaceId);
  }

  return workspace.id;
});

export const getWorkspace = reactCache(async (workspaceId: string): Promise<{ id: string } | null> => {
  validateInputs([workspaceId, z.cuid2()]);

  try {
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      select: {
        id: true,
      },
    });
    return workspace;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error fetching workspace");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
