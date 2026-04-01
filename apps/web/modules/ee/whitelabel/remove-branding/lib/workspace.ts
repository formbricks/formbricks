import "server-only";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { ValidationError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  TWorkspaceUpdateBrandingInput,
  ZWorkspaceUpdateBrandingInput,
} from "@/modules/ee/whitelabel/remove-branding/types/workspace";

export const updateWorkspaceBranding = async (
  workspaceId: string,
  inputWorkspace: TWorkspaceUpdateBrandingInput
): Promise<boolean> => {
  validateInputs([workspaceId, ZId], [inputWorkspace, ZWorkspaceUpdateBrandingInput]);
  try {
    await prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        ...inputWorkspace,
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
      logger.error(error.issues, "Error updating workspace branding");
    }
    throw new ValidationError("Data validation of workspace failed");
  }
};
