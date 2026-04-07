import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import type { TWorkspace } from "@formbricks/types/workspace";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";

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

export const getUserWorkspaces = reactCache(
  async (userId: string, organizationId: string, page?: number): Promise<TWorkspace[]> => {
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

    try {
      const workspaces = await prisma.workspace.findMany({
        where: {
          organizationId,
          ...workspaceWhereClause,
        },
        select: selectWorkspace,
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
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

export const getWorkspaces = reactCache(
  async (organizationId: string, page?: number): Promise<TWorkspace[]> => {
    validateInputs([organizationId, ZId], [page, ZOptionalNumber]);

    try {
      const workspaces = await prisma.workspace.findMany({
        where: {
          organizationId,
        },
        select: selectWorkspace,
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
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

export const getWorkspaceByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TWorkspace | null> => {
    validateInputs([environmentId, ZId]);

    let workspacePrisma;

    try {
      workspacePrisma = await prisma.workspace.findFirst({
        where: {
          environments: {
            some: {
              id: environmentId,
            },
          },
        },
        select: selectWorkspace,
      });

      return workspacePrisma;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error getting workspace by environment id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getWorkspace = reactCache(async (workspaceId: string): Promise<TWorkspace | null> => {
  let workspacePrisma;
  try {
    workspacePrisma = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      select: selectWorkspace,
    });

    return workspacePrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

export const getOrganizationWorkspacesCount = reactCache(async (organizationId: string): Promise<number> => {
  validateInputs([organizationId, ZId]);

  try {
    const workspaces = await prisma.workspace.count({
      where: {
        organizationId,
      },
    });
    return workspaces;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getUserWorkspaceEnvironmentsByOrganizationIds = reactCache(
  async (organizationIds: string[], userId: string): Promise<Pick<TWorkspace, "environments">[]> => {
    validateInputs([organizationIds, ZId.array()], [userId, ZId]);
    try {
      if (organizationIds.length === 0) {
        return [];
      }

      const memberships = await prisma.membership.findMany({
        where: {
          userId,
          organizationId: {
            in: organizationIds,
          },
        },
      });

      if (memberships.length === 0) {
        return [];
      }

      const whereConditions: Prisma.WorkspaceWhereInput[] = memberships.map((membership) => {
        let workspaceWhereClause: Prisma.WorkspaceWhereInput = {
          organizationId: membership.organizationId,
        };

        if (membership.role === "member") {
          workspaceWhereClause = {
            ...workspaceWhereClause,
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

        return workspaceWhereClause;
      });

      const workspaces = await prisma.workspace.findMany({
        where: {
          OR: whereConditions,
        },
        select: { environments: true },
      });

      return workspaces;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(err.message);
      }

      throw err;
    }
  }
);
