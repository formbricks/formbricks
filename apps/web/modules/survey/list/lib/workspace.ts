import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { TWorkspaceWithLanguages } from "@/modules/survey/list/types/surveys";
import { TUserWorkspace } from "@/modules/survey/list/types/workspaces";

export const getWorkspaceWithLanguagesByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TWorkspaceWithLanguages | null> => {
    try {
      const workspacePrisma = await prisma.workspace.findFirst({
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

      return workspacePrisma;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error getting workspace with languages by environment id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getUserWorkspaces = reactCache(
  async (userId: string, organizationId: string): Promise<TUserWorkspace[]> => {
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

      let workspaceWhereClause: Prisma.WorkspaceWhereInput = {};

      if (orgMembership.role === "member") {
        workspaceWhereClause = {
          workspaceTeams: {
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

      const workspaces = await prisma.workspace.findMany({
        where: {
          organizationId,
          ...workspaceWhereClause,
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

      return workspaces;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
