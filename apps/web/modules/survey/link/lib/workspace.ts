import "server-only";
import { Prisma, Workspace } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getWorkspaceByEnvironmentId = reactCache(
  async (
    environmentId: string
  ): Promise<Pick<
    Workspace,
    "styling" | "logo" | "linkSurveyBranding" | "name" | "customHeadScripts"
  > | null> => {
    validateInputs([environmentId, ZId]);

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
        logger.error(error, "Error fetching workspace by environment id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
