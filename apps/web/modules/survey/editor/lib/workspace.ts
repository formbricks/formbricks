import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Language, Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { type TWorkspaceWithoutCustomCss } from "@/modules/custom-css/lib/types";

/**
 * ENG-2949: custom CSS (source, compiled output and the previous revision — up to ~400 KB) is left out.
 * This feeds the editor's client state on every tab-focus refetch; the CSS editor reads it through
 * `getWorkspaceCustomCssRecord` instead.
 */
export type TEditorWorkspace = TWorkspaceWithoutCustomCss;

export const getWorkspace = reactCache(async (workspaceId: string): Promise<TEditorWorkspace | null> => {
  try {
    const workspacePrisma = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      omit: { customCss: true, customCssPrevious: true },
    });

    return workspacePrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error fetching workspace");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

export const getWorkspaceLanguages = reactCache(async (workspaceId: string): Promise<Language[]> => {
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      languages: {
        orderBy: {
          code: "asc",
        },
      },
    },
  });
  if (!workspace) {
    throw new ResourceNotFoundError("Workspace not found", workspaceId);
  }
  return workspace.languages;
});
