import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import type { TProject } from "@formbricks/types/project";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";

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
  async (userId: string, organizationId: string, page?: number): Promise<TProject[]> => {
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
  }
);

export const getProjects = reactCache(async (organizationId: string, page?: number): Promise<TProject[]> => {
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
});

export const getProjectByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TProject | null> => {
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
        logger.error(error, "Error getting project by environment id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getProject = reactCache(async (projectId: string): Promise<TProject | null> => {
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
});

export const getOrganizationProjectsCount = reactCache(async (organizationId: string): Promise<number> => {
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
});

export const getProjectsByOrganizationIds = reactCache(
  async (organizationIds: string[]): Promise<Pick<TProject, "environments">[]> => {
    validateInputs([organizationIds, ZId.array()]);
    try {
      const projects = await prisma.project.findMany({
        where: {
          organizationId: {
            in: organizationIds,
          },
        },
        select: { environments: true },
      });

      return projects;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(err.message);
      }

      throw err;
    }
  }
);
