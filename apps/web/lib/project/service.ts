import "server-only";
import { cache } from "@/lib/cache";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import type { TProject } from "@formbricks/types/project";
import { ITEMS_PER_PAGE } from "../constants";
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
            logger.error(error, "Error getting project by environment id");
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
