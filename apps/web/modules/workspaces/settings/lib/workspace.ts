import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import {
  TWorkspace,
  TWorkspaceUpdateInput,
  ZWorkspace,
  ZWorkspaceUpdateInput,
} from "@formbricks/types/workspace";
import { createEnvironment } from "@/lib/environment/service";
import { validateInputs } from "@/lib/utils/validate";
import { deleteFilesByWorkspaceId } from "@/modules/storage/service";

const selectWorkspace = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  organizationId: true,
  languages: true,
  recontactDays: true,
  linkSurveyBranding: true,
  inAppSurveyBranding: true,
  config: true,
  placement: true,
  clickOutsideClose: true,
  overlay: true,
  environments: true,
  appSetupCompleted: true,
  styling: true,
  logo: true,
  customHeadScripts: true,
};

export const updateWorkspace = async (
  workspaceId: string,
  inputWorkspace: TWorkspaceUpdateInput
): Promise<TWorkspace> => {
  validateInputs([workspaceId, ZId], [inputWorkspace, ZWorkspaceUpdateInput]);
  const { environments, ...data } = inputWorkspace;
  let updatedWorkspace;
  try {
    updatedWorkspace = await prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        ...data,
        environments: {
          connect: environments?.map((environment) => ({ id: environment.id })) ?? [],
        },
      },
      select: selectWorkspace,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  try {
    const workspace = ZWorkspace.parse(updatedWorkspace);

    return workspace;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(error.issues, "Error updating workspace");
    }
    throw new ValidationError("Data validation of workspace failed");
  }
};

export const createWorkspace = async (
  organizationId: string,
  workspaceInput: Partial<TWorkspaceUpdateInput>
): Promise<TWorkspace> => {
  validateInputs([organizationId, ZString], [workspaceInput, ZWorkspaceUpdateInput.partial()]);

  if (!workspaceInput.name) {
    throw new ValidationError("Workspace Name is required");
  }

  const { environments, teamIds, ...data } = workspaceInput;

  try {
    let workspace = await prisma.workspace.create({
      data: {
        config: {
          channel: null,
          industry: null,
        },
        ...data,
        name: workspaceInput.name,
        organizationId,
      },
      select: selectWorkspace,
    });

    if (teamIds) {
      await prisma.workspaceTeam.createMany({
        data: teamIds.map((teamId) => ({
          workspaceId: workspace.id,
          teamId,
        })),
      });
    }

    const prodEnvironment = await createEnvironment(workspace.id, {
      type: "production",
    });

    const updatedWorkspace = await updateWorkspace(workspace.id, {
      environments: [prodEnvironment],
    });

    return updatedWorkspace;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("A workspace with this name already exists in your organization");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteWorkspace = async (workspaceId: string): Promise<TWorkspace> => {
  try {
    const workspace = await prisma.workspace.delete({
      where: {
        id: workspaceId,
      },
      select: selectWorkspace,
    });

    if (workspace) {
      // delete all files from storage — both workspaceId-prefixed (new) and environmentId-prefixed (legacy)
      const environmentIds = workspace.environments.map((env) => env.id);
      const s3Result = await deleteFilesByWorkspaceId(workspaceId, environmentIds);

      if (!s3Result.ok) {
        // fail silently because we don't want to throw an error if the files are not deleted
        logger.error(s3Result.error, "Error deleting S3 files");
      }
    }

    return workspace;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
