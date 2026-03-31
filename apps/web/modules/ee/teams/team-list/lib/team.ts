import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  TOrganizationTeam,
  TOtherTeam,
  TTeamDetails,
  TTeamSettingsFormSchema,
  TUserTeam,
  ZTeamSettingsFormSchema,
} from "@/modules/ee/teams/team-list/types/team";

export const getTeamsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationTeam[] | null> => {
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

      const workspaceTeams = teams.map((team) => ({
        id: team.id,
        name: team.name,
      }));

      return workspaceTeams;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getUserTeams = reactCache(
  async (userId: string, organizationId: string): Promise<TUserTeam[]> => {
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
  }
);

export const getOtherTeams = reactCache(
  async (userId: string, organizationId: string): Promise<TOtherTeam[]> => {
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
  }
);

export const getTeams = reactCache(
  async (
    userId: string,
    organizationId: string
  ): Promise<{ userTeams: TUserTeam[]; otherTeams: TOtherTeam[] }> => {
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
  }
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

    return team.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getTeamDetails = reactCache(async (teamId: string): Promise<TTeamDetails | null> => {
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
        workspaceTeams: {
          select: {
            workspaceId: true,
            workspace: {
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
      workspaces: team.workspaceTeams.map((workspaceTeam) => ({
        workspaceId: workspaceTeam.workspaceId,
        workspaceName: workspaceTeam.workspace.name,
        permission: workspaceTeam.permission,
      })),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const deleteTeam = async (teamId: string): Promise<boolean> => {
  validateInputs([teamId, ZId]);
  try {
    await prisma.team.delete({
      where: {
        id: teamId,
      },
      select: {
        organizationId: true,
        workspaceTeams: {
          select: {
            workspaceId: true,
          },
        },
      },
    });

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
    const { name, members, workspaces } = data;

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

    // Check that all specified workspaces belong to the same organization.
    const workspaceIds = workspaces.map((p) => p.workspaceId);
    if (workspaceIds.length > 0) {
      const orgWorkspacesCount = await prisma.workspace.count({
        where: {
          id: { in: workspaceIds },
          organizationId: team.organizationId,
        },
      });
      if (orgWorkspacesCount !== workspaceIds.length) {
        throw new Error("Some specified workspaces do not belong to the organization.");
      }
    }

    // Arrays for tracking member changes
    const deletedMembers: string[] = [];

    // Arrays for tracking workspace changes
    const deletedWorkspaces: string[] = [];

    // Determine deleted members (in current but not in new)
    for (const cm of currentTeamDetails.members) {
      if (!members.some((m) => m.userId === cm.userId)) {
        deletedMembers.push(cm.userId);
      }
    }

    // Determine deleted workspaces (in current but not in new)
    for (const cp of currentTeamDetails.workspaces) {
      if (!workspaces.some((p) => p.workspaceId === cp.workspaceId)) {
        deletedWorkspaces.push(cp.workspaceId);
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
      workspaceTeams: {
        deleteMany: {
          workspaceId: { in: deletedWorkspaces },
        },
        upsert: workspaces.map((p) => ({
          where: { workspaceId_teamId: { teamId, workspaceId: p.workspaceId } },
          update: { permission: p.permission },
          create: { workspaceId: p.workspaceId, permission: p.permission },
        })),
      },
    };

    await prisma.team.update({
      where: { id: teamId },
      data: payload,
    });

    const changedWorkspaceIds = [...workspaces.map((p) => p.workspaceId), ...deletedWorkspaces];

    await prisma.environment.findMany({
      where: {
        workspaceId: {
          in: changedWorkspaceIds,
        },
      },
      select: {
        id: true,
      },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
