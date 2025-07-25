import "server-only";
import { isS3Configured } from "@/lib/constants";
import { createEnvironment } from "@/lib/environment/service";
import { deleteLocalFilesByEnvironmentId, deleteS3FilesByEnvironmentId } from "@/lib/storage/service";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { TProject, TProjectUpdateInput, ZProject, ZProjectUpdateInput } from "@formbricks/types/project";

const selectProject = {
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
  darkOverlay: true,
  environments: true,
  styling: true,
  logo: true,
};

export const updateProject = async (
  projectId: string,
  inputProject: TProjectUpdateInput
): Promise<TProject> => {
  validateInputs([projectId, ZId], [inputProject, ZProjectUpdateInput]);
  const { environments, ...data } = inputProject;
  let updatedProject;
  try {
    updatedProject = await prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        ...data,
        environments: {
          connect: environments?.map((environment) => ({ id: environment.id })) ?? [],
        },
      },
      select: selectProject,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  try {
    const project = ZProject.parse(updatedProject);

    return project;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(error.errors, "Error updating project");
    }
    throw new ValidationError("Data validation of project failed");
  }
};

export const createProject = async (
  organizationId: string,
  projectInput: Partial<TProjectUpdateInput>
): Promise<TProject> => {
  validateInputs([organizationId, ZString], [projectInput, ZProjectUpdateInput.partial()]);

  if (!projectInput.name) {
    throw new ValidationError("Project Name is required");
  }

  const { environments, teamIds, ...data } = projectInput;

  try {
    let project = await prisma.project.create({
      data: {
        config: {
          channel: null,
          industry: null,
        },
        ...data,
        name: projectInput.name,
        organizationId,
      },
      select: selectProject,
    });

    if (teamIds) {
      await prisma.projectTeam.createMany({
        data: teamIds.map((teamId) => ({
          projectId: project.id,
          teamId,
        })),
      });
    }

    const devEnvironment = await createEnvironment(project.id, {
      type: "development",
    });

    const prodEnvironment = await createEnvironment(project.id, {
      type: "production",
    });

    const updatedProject = await updateProject(project.id, {
      environments: [devEnvironment, prodEnvironment],
    });

    return updatedProject;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("A project with this name already exists in your organization");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteProject = async (projectId: string): Promise<TProject> => {
  try {
    const project = await prisma.project.delete({
      where: {
        id: projectId,
      },
      select: selectProject,
    });

    if (project) {
      // delete all files from storage related to this project

      if (isS3Configured()) {
        const s3FilesPromises = project.environments.map(async (environment) => {
          return deleteS3FilesByEnvironmentId(environment.id);
        });

        try {
          await Promise.all(s3FilesPromises);
        } catch (err) {
          // fail silently because we don't want to throw an error if the files are not deleted
          logger.error(err, "Error deleting S3 files");
        }
      } else {
        const localFilesPromises = project.environments.map(async (environment) => {
          return deleteLocalFilesByEnvironmentId(environment.id);
        });

        try {
          await Promise.all(localFilesPromises);
        } catch (err) {
          // fail silently because we don't want to throw an error if the files are not deleted
          logger.error(err, "Error deleting local files");
        }
      }
    }

    return project;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
