import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { TWorkspace, TWorkspaceUpdateInput, ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
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
  const { ...data } = inputWorkspace;
  let updatedWorkspace;
  try {
    updatedWorkspace = await prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data,
      select: selectWorkspace,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  return updatedWorkspace as TWorkspace;
};

export const createWorkspace = async (
  organizationId: string,
  workspaceInput: Partial<TWorkspaceUpdateInput>
): Promise<TWorkspace> => {
  validateInputs([organizationId, ZString], [workspaceInput, ZWorkspaceUpdateInput.partial()]);

  if (!workspaceInput.name) {
    throw new ValidationError("Workspace Name is required");
  }

  const { teamIds, ...data } = workspaceInput;

  try {
    const workspace = await prisma.workspace.create({
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

    // Create + link default FRD only for first workspace in org
    const existingFrdCount = await prisma.feedbackRecordDirectory.count({ where: { organizationId } });

    if (existingFrdCount === 0) {
      const frd = await prisma.feedbackRecordDirectory.create({
        data: { name: "Default Feedback Record Directory", organizationId },
        select: { id: true },
      });

      await prisma.feedbackRecordDirectoryWorkspace.create({
        data: {
          feedbackRecordDirectoryId: frd.id,
          workspaceId: workspace.id,
        },
      });
    }

    return workspace;
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
      const s3Result = await deleteFilesByWorkspaceId(workspaceId, []);

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
