import "server-only";
import { teamCache } from "@/lib/cache/team";
import {
  TOrganizationTeam,
  TProjectTeam,
  TTeamPermission,
  ZTeamPermission,
} from "@/modules/ee/teams/project-teams/types/teams";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getTeamsByProjectId = reactCache(
  async (projectId: string): Promise<TProjectTeam[] | null> =>
    cache(
      async () => {
        validateInputs([projectId, ZId]);
        try {
          const project = await prisma.project.findUnique({
            where: {
              id: projectId,
            },
          });

          if (!project) {
            throw new ResourceNotFoundError("Project", projectId);
          }

          const teams = await prisma.team.findMany({
            where: {
              projectTeams: {
                some: {
                  projectId: projectId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              projectTeams: {
                where: {
                  projectId: projectId,
                },
                select: {
                  permission: true,
                },
              },
              _count: {
                select: {
                  teamUsers: true,
                },
              },
            },
          });

          const projectTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
            permission: team.projectTeams[0].permission,
            memberCount: team._count.teamUsers,
          }));

          return projectTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeamsByProjectId-${projectId}`],
      {
        tags: [teamCache.tag.byProjectId(projectId), projectCache.tag.byId(projectId)],
      }
    )()
);

export const removeTeamAccess = async (projectId: string, teamId: string): Promise<boolean> => {
  validateInputs([projectId, ZId], [teamId, ZId]);
  try {
    const projectMembership = await prisma.projectTeam.findFirst({
      where: {
        projectId: projectId,
        teamId,
      },
    });

    if (!projectMembership) {
      throw new AuthorizationError("Team does not have access to this project");
    }

    await prisma.projectTeam.deleteMany({
      where: {
        projectId: projectId,
        teamId,
      },
    });

    teamCache.revalidate({
      id: teamId,
      projectId: projectId,
    });
    projectCache.revalidate({
      id: projectId,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const addTeamAccess = async (projectId: string, teamIds: string[]): Promise<boolean> => {
  validateInputs([projectId, ZId], [teamIds, z.array(ZId)]);
  try {
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      throw new ResourceNotFoundError("Project", projectId);
    }

    for (let teamId of teamIds) {
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          organizationId: project.organizationId,
        },
      });

      if (!team) {
        throw new ResourceNotFoundError("Team", teamId);
      }

      const projectTeam = await prisma.projectTeam.findFirst({
        where: {
          projectId,
          teamId,
        },
      });

      if (projectTeam) {
        throw new AuthorizationError("Teams already have access to this project");
      }

      await prisma.projectTeam.create({
        data: {
          projectId,
          teamId,
        },
      });
    }

    teamCache.revalidate({
      projectId: projectId,
    });
    projectCache.revalidate({
      id: projectId,
    });

    teamIds.forEach((teamId) => {
      teamCache.revalidate({
        id: teamId,
      });
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getTeamsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationTeam[] | null> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId]);
        try {
          const teams = await prisma.team.findMany({
            where: {
              organizationId,
            },
            select: {
              id: true,
              name: true,
            },
          });

          const projectTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
          }));

          return projectTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeamsByOrganizationId-${organizationId}`],
      {
        tags: [teamCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const updateTeamAccessPermission = async (
  projectId: string,
  teamId: string,
  permission: TTeamPermission
): Promise<boolean> => {
  validateInputs([projectId, ZId], [teamId, ZId], [permission, ZTeamPermission]);
  try {
    const projectMembership = await prisma.projectTeam.findUniqueOrThrow({
      where: {
        projectId_teamId: {
          projectId,
          teamId,
        },
      },
    });

    if (!projectMembership) {
      throw new AuthorizationError("Team does not have access to this project");
    }

    await prisma.projectTeam.update({
      where: {
        projectId_teamId: {
          projectId,
          teamId,
        },
      },
      data: {
        permission,
      },
    });

    teamCache.revalidate({
      id: teamId,
      projectId: projectId,
    });

    projectCache.revalidate({
      id: projectId,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
