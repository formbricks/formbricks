import "server-only";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import {
  lookupAuthorizedOrganizationIds,
  lookupAuthorizedWorkspaceIds,
} from "@/lib/authorization/resource-list";
import { validateInputs } from "@/lib/utils/validate";
import { TWorkspaceWithLanguages } from "@/modules/survey/list/types/surveys";
import { TUserWorkspace } from "@/modules/survey/list/types/workspaces";

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

export const getWorkspaceWithLanguages = reactCache(
  async (workspaceId: string): Promise<TWorkspaceWithLanguages | null> => {
    try {
      const workspacePrisma = await prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
        select: {
          id: true,
          languages: true,
        },
      });

      return workspacePrisma;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error getting workspace with languages");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getUserWorkspaces = reactCache(
  async (userId: string, organizationId: string): Promise<TUserWorkspace[]> => {
    const actor = { type: "user", id: userId } as const;
    const [authorizedOrganizationIds, authorizedWorkspaceIds] = await Promise.all([
      lookupAuthorizedOrganizationIds(actor),
      lookupAuthorizedWorkspaceIds(actor),
    ]);

    if (!authorizedOrganizationIds.includes(organizationId)) {
      throw new ValidationError("User is not a member of this organization");
    }

    try {
      const workspaces = await prisma.workspace.findMany({
        where: {
          id: { in: [...authorizedWorkspaceIds] },
          organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      return workspaces;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
