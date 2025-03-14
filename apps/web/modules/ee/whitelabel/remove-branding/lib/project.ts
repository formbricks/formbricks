import "server-only";
import {
  TProjectUpdateBrandingInput,
  ZProjectUpdateBrandingInput,
} from "@/modules/ee/whitelabel/remove-branding/types/project";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { projectCache } from "@formbricks/lib/project/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { ValidationError } from "@formbricks/types/errors";

export const updateProjectBranding = async (
  projectId: string,
  inputProject: TProjectUpdateBrandingInput
): Promise<boolean> => {
  validateInputs([projectId, ZId], [inputProject, ZProjectUpdateBrandingInput]);
  try {
    const updatedProject = await prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        ...inputProject,
      },
      select: {
        id: true,
        organizationId: true,
        environments: {
          select: {
            id: true,
          },
        },
      },
    });

    projectCache.revalidate({
      id: updatedProject.id,
      organizationId: updatedProject.organizationId,
    });

    updatedProject.environments.forEach((environment) => {
      // revalidate environment cache
      projectCache.revalidate({
        environmentId: environment.id,
      });
    });

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(error.errors, "Error updating project branding");
    }
    throw new ValidationError("Data validation of project failed");
  }
};
