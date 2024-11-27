import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import type { TProject, TProjectUpdateInput } from "@formbricks/types/project";
import { ZProject, ZProjectUpdateInput } from "@formbricks/types/project";
import { cache } from "../cache";
import { ITEMS_PER_PAGE, isS3Configured } from "../constants";
import { environmentCache } from "../environment/cache";
import { createEnvironment } from "../environment/service";
import { deleteLocalFilesByEnvironmentId, deleteS3FilesByEnvironmentId } from "../storage/service";
import { validateInputs } from "../utils/validate";
import { projectCache } from "./cache";

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

export const getUserProjects = reactCache(
  async (userId: string, organizationId: string, page?: number): Promise<TProject[]> =>
    cache(
      async () => {
        validateInputs([userId, ZString], [organizationId, ZId], [page, ZOptionalNumber]);

        const orgMembership = await prisma.membership.findFirst({
          where: {
            userId,
            organizationId,
          },
        });

        if (!orgMembership) {
          throw new ValidationError("User is not a member of this organization");
        }

        let projectWhereClause: Prisma.ProjectWhereInput = {};

        if (orgMembership.role === "member") {
          projectWhereClause = {
            projectTeams: {
              some: {
                team: {
                  teamUsers: {
                    some: {
                      userId,
                    },
                  },
                },
              },
            },
          };
        }

        try {
          const projects = await prisma.project.findMany({
            where: {
              organizationId,
              ...projectWhereClause,
            },
            select: selectProject,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });
          return projects;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getUserProjects-${userId}-${organizationId}-${page}`],
      {
        tags: [projectCache.tag.byUserId(userId), projectCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const getProjects = reactCache(
  async (organizationId: string, page?: number): Promise<TProject[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId], [page, ZOptionalNumber]);

        try {
          const projects = await prisma.project.findMany({
            where: {
              organizationId,
            },
            select: selectProject,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });
          return projects;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getProjects-${organizationId}-${page}`],
      {
        tags: [projectCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const getProjectByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TProject | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        let projectPrisma;

        try {
          projectPrisma = await prisma.project.findFirst({
            where: {
              environments: {
                some: {
                  id: environmentId,
                },
              },
            },
            select: selectProject,
          });

          return projectPrisma;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getProjectByEnvironmentId-${environmentId}`],
      {
        tags: [projectCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

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

export const getProject = reactCache(
  async (projectId: string): Promise<TProject | null> =>
    cache(
      async () => {
        let projectPrisma;
        try {
          projectPrisma = await prisma.project.findUnique({
            where: {
              id: projectId,
            },
            select: selectProject,
          });

          return projectPrisma;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getProject-${projectId}`],
      {
        tags: [projectCache.tag.byId(projectId)],
      }
    )()
);

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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getOrganizationProjectsCount = reactCache(
  async (organizationId: string): Promise<number> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId]);

        try {
          const projects = await prisma.project.count({
            where: {
              organizationId,
            },
          });
          return projects;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getOrganizationProjectsCount-${organizationId}`],
      {
        revalidate: 60 * 60 * 2, // 2 hours
        tags: [projectCache.tag.byOrganizationId(organizationId)],
      }
    )()
);
