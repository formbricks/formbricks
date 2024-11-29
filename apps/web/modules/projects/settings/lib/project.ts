import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { isS3Configured } from "@formbricks/lib/constants";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { createEnvironment } from "@formbricks/lib/environment/service";
import { projectCache } from "@formbricks/lib/project/cache";
import {
  deleteLocalFilesByEnvironmentId,
  deleteS3FilesByEnvironmentId,
} from "@formbricks/lib/storage/service";
import { validateInputs } from "@formbricks/lib/utils/validate";
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

    projectCache.revalidate({
      id: project.id,
      organizationId: project.organizationId,
    });

    project.environments.forEach((environment) => {
      // revalidate environment cache
      projectCache.revalidate({
        environmentId: environment.id,
      });
    });

    return project;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
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

    projectCache.revalidate({
      id: project.id,
      organizationId: project.organizationId,
    });

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new InvalidInputError("A project with this name already exists in your organization");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new InvalidInputError("A project with this name already exists in this organization");
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
          console.error(err);
        }
      } else {
        const localFilesPromises = project.environments.map(async (environment) => {
          return deleteLocalFilesByEnvironmentId(environment.id);
        });

        try {
          await Promise.all(localFilesPromises);
        } catch (err) {
          // fail silently because we don't want to throw an error if the files are not deleted
          console.error(err);
        }
      }

      projectCache.revalidate({
        id: project.id,
        organizationId: project.organizationId,
      });

      environmentCache.revalidate({
        projectId: project.id,
      });

      project.environments.forEach((environment) => {
        // revalidate project cache
        projectCache.revalidate({
          environmentId: environment.id,
        });
        environmentCache.revalidate({
          id: environment.id,
        });
      });
    }

    return project;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
