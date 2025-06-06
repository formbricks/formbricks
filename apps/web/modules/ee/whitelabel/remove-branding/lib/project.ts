import "server-only";
import { validateInputs } from "@/lib/utils/validate";
import {
  TProjectUpdateBrandingInput,
  ZProjectUpdateBrandingInput,
} from "@/modules/ee/whitelabel/remove-branding/types/project";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { ValidationError } from "@formbricks/types/errors";

export const updateProjectBranding = async (
  projectId: string,
  inputProject: TProjectUpdateBrandingInput
): Promise<boolean> => {
  validateInputs([projectId, ZId], [inputProject, ZProjectUpdateBrandingInput]);
  try {
    await prisma.project.update({
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

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(error.errors, "Error updating project branding");
    }
    throw new ValidationError("Data validation of project failed");
  }
};
