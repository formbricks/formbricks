import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma, Workspace } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { sanitizeThemeStyling } from "@formbricks/types/styling-values";

// ENG-2949: custom CSS is left out — this workspace reaches client props on the survey list, templates
// and editor pages, and the stored CSS with its previous revision can be ~400 KB. The CSS editor reads
// it through `getWorkspaceCustomCssRecord`.
type WorkspaceWithTeam = Omit<Workspace, "customCss" | "customCssPrevious"> & {
  teamIds: string[];
};

export const getWorkspaceWithTeamIds = reactCache(
  async (workspaceId: string): Promise<WorkspaceWithTeam | null> => {
    let workspacePrisma: Prisma.WorkspaceGetPayload<{
      include: { workspaceTeams: { select: { teamId: true } } };
      omit: { customCss: true; customCssPrevious: true };
    }> | null = null;

    try {
      workspacePrisma = await prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
        include: {
          workspaceTeams: {
            select: {
              teamId: true,
            },
          },
        },
        omit: { customCss: true, customCssPrevious: true },
      });

      if (!workspacePrisma) {
        return null;
      }

      const teamIds = workspacePrisma.workspaceTeams.map((workspaceTeam) => workspaceTeam.teamId);

      return {
        ...workspacePrisma,
        // The editor copies the workspace theme into the survey it saves, so a value saved before the
        // strict theme-value schemas (ENG-2950) would otherwise fail every save and autosave.
        styling: sanitizeThemeStyling(workspacePrisma.styling),
        teamIds,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error fetching workspace by id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
