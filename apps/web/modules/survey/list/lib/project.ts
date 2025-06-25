import "server-only";
import { TUserProject } from "@/modules/survey/list/types/projects";
import { TProjectWithLanguages } from "@/modules/survey/list/types/surveys";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";

export const getProjectWithLanguagesByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TProjectWithLanguages | null> => {
    try {
      const projectPrisma = await prisma.project.findFirst({
        where: {
          environments: {
            some: {
              id: environmentId,
            },
          },
        },
        select: {
          id: true,
          languages: true,
        },
      });

      return projectPrisma;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error getting project with languages by environment id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getUserProjects = reactCache(
  async (userId: string, organizationId: string): Promise<TUserProject[]> => {
    try {
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

      const projects = await prisma.project.findMany({
        where: {
          organizationId,
          ...projectWhereClause,
        },
        select: {
          id: true,
          name: true,
          environments: {
            select: {
              id: true,
              type: true,
            },
          },
        },
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
