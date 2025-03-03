import "server-only";
import { organizationCache } from "@/lib/cache/organization";
import { teamCache } from "@/lib/cache/team";
import {
  TOrganizationTeam,
  TOtherTeam,
  TTeamDetails,
  TTeamSettingsFormSchema,
  TUserTeam,
  ZTeamSettingsFormSchema,
} from "@/modules/ee/teams/team-list/types/team";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { userCache } from "@formbricks/lib/user/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

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

const getUserTeams = reactCache(
  async (userId: string, organizationId: string): Promise<TUserTeam[]> =>
    cache(
      async () => {
        validateInputs([userId, z.string()], [organizationId, ZId]);
        try {
          const teams = await prisma.team.findMany({
            where: {
              organizationId,
              teamUsers: {
                some: {
                  userId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              teamUsers: {
                where: {
                  userId,
                },
                select: {
                  role: true,
                },
              },
              _count: {
                select: {
                  teamUsers: true,
                },
              },
            },
          });

          const userTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
            userRole: team.teamUsers[0].role,
            memberCount: team._count.teamUsers,
          }));

          return userTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getUserTeams-${userId}-${organizationId}`],
      {
        tags: [
          teamCache.tag.byUserId(userId),
          userCache.tag.byId(userId),
          teamCache.tag.byOrganizationId(organizationId),
        ],
      }
    )()
);

export const getOtherTeams = reactCache(
  async (userId: string, organizationId: string): Promise<TOtherTeam[]> =>
    cache(
      async () => {
        validateInputs([userId, z.string()], [organizationId, ZId]);
        try {
          const teams = await prisma.team.findMany({
            where: {
              organizationId,
              teamUsers: {
                none: {
                  userId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  teamUsers: true,
                },
              },
            },
          });

          const otherTeams = teams.map((team) => ({
            id: team.id,
            name: team.name,
            memberCount: team._count.teamUsers,
          }));

          return otherTeams;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getOtherTeams-${userId}-${organizationId}`],
      {
        tags: [
          teamCache.tag.byUserId(userId),
          userCache.tag.byId(userId),
          teamCache.tag.byOrganizationId(organizationId),
        ],
      }
    )()
);

export const getTeams = reactCache(
  async (
    userId: string,
    organizationId: string
  ): Promise<{ userTeams: TUserTeam[]; otherTeams: TOtherTeam[] }> =>
    cache(
      async () => {
        const membership = await prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId,
              organizationId,
            },
          },
          select: {
            role: true,
          },
        });

        if (!membership) {
          throw new ResourceNotFoundError("Membership", null);
        }

        const userTeams = await getUserTeams(userId, organizationId);
        let otherTeams = await getOtherTeams(userId, organizationId);

        return { userTeams, otherTeams };
      },
      [`getTeams-${userId}-${organizationId}`],
      {
        tags: [
          teamCache.tag.byUserId(userId),
          userCache.tag.byId(userId),
          teamCache.tag.byOrganizationId(organizationId),
        ],
      }
    )()
);

export const createTeam = async (organizationId: string, name: string): Promise<string> => {
  validateInputs([organizationId, ZId], [name, z.string()]);
  try {
    const doesTeamExist = await prisma.team.findFirst({
      where: {
        name,
        organizationId,
      },
    });

    if (doesTeamExist) {
      throw new InvalidInputError("Team name already exists");
    }

    if (name.length < 1) {
      throw new InvalidInputError("Team name must be at least 1 character long");
    }

    const team = await prisma.team.create({
      data: {
        name,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    teamCache.revalidate({ organizationId });

    return team.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getTeamDetails = reactCache(
  async (teamId: string): Promise<TTeamDetails | null> =>
    cache(
      async () => {
        validateInputs([teamId, ZId]);
        try {
          const team = await prisma.team.findUnique({
            where: {
              id: teamId,
            },
            select: {
              id: true,
              name: true,
              organizationId: true,
              teamUsers: {
                select: {
                  userId: true,
                  role: true,
                  user: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              projectTeams: {
                select: {
                  projectId: true,
                  project: {
                    select: {
                      name: true,
                    },
                  },
                  permission: true,
                },
              },
            },
          });

          if (!team) {
            return null;
          }

          return {
            id: team.id,
            name: team.name,
            organizationId: team.organizationId,
            members: team.teamUsers.map((teamUser) => ({
              userId: teamUser.userId,
              name: teamUser.user.name,
              role: teamUser.role,
            })),
            projects: team.projectTeams.map((projectTeam) => ({
              projectId: projectTeam.projectId,
              projectName: projectTeam.project.name,
              permission: projectTeam.permission,
            })),
          };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeamDetails-${teamId}`],
      {
        tags: [teamCache.tag.byId(teamId)],
      }
    )()
);

export const deleteTeam = async (teamId: string): Promise<boolean> => {
  validateInputs([teamId, ZId]);
  try {
    const deletedTeam = await prisma.team.delete({
      where: {
        id: teamId,
      },
      select: {
        organizationId: true,
        projectTeams: {
          select: {
            projectId: true,
          },
        },
      },
    });

    teamCache.revalidate({ id: teamId, organizationId: deletedTeam.organizationId });

    for (const projectTeam of deletedTeam.projectTeams) {
      teamCache.revalidate({ projectId: projectTeam.projectId });
    }

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateTeamDetails = async (teamId: string, data: TTeamSettingsFormSchema): Promise<boolean> => {
  validateInputs([teamId, ZId], [data, ZTeamSettingsFormSchema]);

  try {
    const { name, members, projects } = data;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new ResourceNotFoundError("Team", teamId);
    }

    const currentTeamDetails = await getTeamDetails(teamId);
    if (!currentTeamDetails) {
      throw new Error("Team not found");
    }

    // Check that all users exist within the organization's membership.
    const userIds = members.map((m) => m.userId);
    if (userIds.length > 0) {
      const orgUsersCount = await prisma.membership.count({
        where: {
          userId: { in: userIds },
          organizationId: team.organizationId,
        },
      });
      if (orgUsersCount !== userIds.length) {
        throw new Error("Some specified users do not belong to the organization's membership.");
      }
    }

    // Check that all specified projects belong to the same organization.
    const projectIds = projects.map((p) => p.projectId);
    if (projectIds.length > 0) {
      const orgProjectsCount = await prisma.project.count({
        where: {
          id: { in: projectIds },
          organizationId: team.organizationId,
        },
      });
      if (orgProjectsCount !== projectIds.length) {
        throw new Error("Some specified projects do not belong to the organization.");
      }
    }

    // Arrays for tracking member changes
    const deletedMembers: string[] = [];

    // Arrays for tracking project changes
    const deletedProjects: string[] = [];

    // Determine deleted members (in current but not in new)
    for (const cm of currentTeamDetails.members) {
      if (!members.some((m) => m.userId === cm.userId)) {
        deletedMembers.push(cm.userId);
      }
    }

    // Determine deleted projects (in current but not in new)
    for (const cp of currentTeamDetails.projects) {
      if (!projects.some((p) => p.projectId === cp.projectId)) {
        deletedProjects.push(cp.projectId);
      }
    }

    // Now build the payload using the arrays computed above
    const payload: Prisma.TeamUpdateInput = {
      name: currentTeamDetails.name !== name ? name : undefined,
      teamUsers: {
        deleteMany: {
          userId: { in: deletedMembers },
        },
        upsert: members.map((m) => ({
          where: { teamId_userId: { teamId, userId: m.userId } },
          update: { role: m.role },
          create: { userId: m.userId, role: m.role },
        })),
      },
      projectTeams: {
        deleteMany: {
          projectId: { in: deletedProjects },
        },
        upsert: projects.map((p) => ({
          where: { projectId_teamId: { teamId, projectId: p.projectId } },
          update: { permission: p.permission },
          create: { projectId: p.projectId, permission: p.permission },
        })),
      },
    };

    await prisma.team.update({
      where: { id: teamId },
      data: payload,
    });

    const changedUserIds = [...members.map((m) => m.userId), ...deletedMembers];
    const changedProjectIds = [...projects.map((p) => p.projectId), ...deletedProjects];

    for (const userId of changedUserIds) {
      teamCache.revalidate({ userId });
      projectCache.revalidate({ userId });
    }

    for (const projectId of changedProjectIds) {
      teamCache.revalidate({ projectId });
      projectCache.revalidate({ id: projectId });
    }

    teamCache.revalidate({ id: teamId, organizationId: team.organizationId });
    projectCache.revalidate({ organizationId: team.organizationId });

    const changedEnvironmentIds = await prisma.environment.findMany({
      where: {
        projectId: {
          in: changedProjectIds,
        },
      },
      select: {
        id: true,
      },
    });

    for (const environment of changedEnvironmentIds) {
      organizationCache.revalidate({ environmentId: environment.id });
    }

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
