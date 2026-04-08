import "server-only";
import { Prisma, Workspace } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getWorkspaceById = reactCache(
  async (
    workspaceId: string
  ): Promise<Pick<
    Workspace,
    "styling" | "logo" | "linkSurveyBranding" | "name" | "customHeadScripts"
  > | null> => {
    validateInputs([workspaceId, ZId]);

    let workspacePrisma;

    try {
      workspacePrisma = await prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
        select: {
          styling: true,
          logo: true,
          linkSurveyBranding: true,
          name: true,
          customHeadScripts: true,
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
  }
);
