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

type TCreateWorkspaceInput = Partial<TWorkspaceUpdateInput> & {
  feedbackDirectoryId?: string;
};

const ZCreateWorkspaceInput = ZWorkspaceUpdateInput.partial().extend({
  feedbackDirectoryId: ZId.optional(),
});

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
  workspaceInput: TCreateWorkspaceInput
): Promise<TWorkspace> => {
  validateInputs([organizationId, ZString], [workspaceInput, ZCreateWorkspaceInput]);

  if (!workspaceInput.name) {
    throw new ValidationError("Workspace Name is required");
  }

  const { teamIds, feedbackDirectoryId, ...data } = workspaceInput;

  try {
    if (feedbackDirectoryId) {
      const feedbackDirectory = await prisma.feedbackDirectory.findFirst({
        where: {
          id: feedbackDirectoryId,
          organizationId,
          isArchived: false,
        },
        select: { id: true },
      });

      if (!feedbackDirectory) {
        throw new InvalidInputError("FEEDBACK_DIRECTORY_NOT_FOUND");
      }
    }

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

    if (feedbackDirectoryId) {
      await prisma.feedbackDirectoryWorkspace.create({
        data: {
          feedbackDirectoryId,
          workspaceId: workspace.id,
        },
      });

      return workspace;
    }

    // Ensure default FRD exists + link to first workspace atomically
    const defaultFrd = await prisma.feedbackDirectory.upsert({
      where: {
        organizationId_name: { organizationId, name: "Default Feedback Directory" },
      },
      create: { name: "Default Feedback Directory", organizationId },
      update: {},
      select: { id: true },
    });

    // Link only if this is the first workspace (no existing links for this FRD)
    const existingLinks = await prisma.feedbackDirectoryWorkspace.count({
      where: { feedbackDirectoryId: defaultFrd.id },
    });

    if (existingLinks === 0) {
      await prisma.feedbackDirectoryWorkspace.create({
        data: {
          feedbackDirectoryId: defaultFrd.id,
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
