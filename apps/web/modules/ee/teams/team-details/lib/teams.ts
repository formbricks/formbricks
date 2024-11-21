import "server-only";
import { membershipCache } from "@/lib/cache/membership";
import { teamCache } from "@/lib/cache/team";
import { TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/project-teams/types/teams";
import {
  TOrganizationMember,
  TOrganizationProject,
  TTeam,
  TTeamProject,
  ZTeam,
} from "@/modules/ee/teams/team-details/types/teams";
import { TTeamRole, ZTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { Prisma, TeamUserRole } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import {
  AuthorizationError,
  DatabaseError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";

export const getTeam = reactCache(
  async (teamId: string): Promise<TTeam> =>
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
            },
          });

          if (!team) {
            throw new ResourceNotFoundError("team", teamId);
          }

          const teamMemberships = await prisma.teamUser.findMany({
            where: {
              teamId,
            },
            select: {
              role: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  memberships: {
                    where: {
                      organizationId: team.organizationId,
                    },
                    select: {
                      role: true,
                    },
                  },
                },
              },
            },
          });

          if (!team) {
            throw new ResourceNotFoundError("team", teamId);
          }

          const teamMembers = teamMemberships.map((teamMember) => ({
            role: teamMember.role,
            id: teamMember.user.id,
            name: teamMember.user.name,
            email: teamMember.user.email,
            isRoleEditable:
              teamMember.user.memberships[0].role !== "owner" &&
              teamMember.user.memberships[0].role !== "manager",
          }));

          return {
            id: team.id,
            name: team.name,
            teamUsers: teamMembers,
          };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeam-${teamId}`],
      { tags: [teamCache.tag.byId(teamId)] }
    )()
);

export const updateTeamName = async (teamId: string, name: string): Promise<{ name: string }> => {
  validateInputs([teamId, ZId], [name, ZTeam.shape.name]);
  try {
    const updatedTeam = await prisma.team.update({
      where: {
        id: teamId,
      },
      data: {
        name,
      },
      select: {
        organizationId: true,
        name: true,
        projectTeams: {
          select: {
            projectId: true,
          },
        },
      },
    });

    teamCache.revalidate({ id: teamId, organizationId: updatedTeam.organizationId });

    for (const projectTeam of updatedTeam.projectTeams) {
      teamCache.revalidate({ projectId: projectTeam.projectId });
    }

    return { name: updatedTeam.name };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

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

export const updateUserTeamRole = async (
  teamId: string,
  userId: string,
  role: TTeamRole
): Promise<boolean> => {
  validateInputs([teamId, ZId], [userId, ZId], [role, ZTeamRole]);
  try {
    const teamMembership = await prisma.teamUser.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: {
        team: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!teamMembership) {
      throw new ResourceNotFoundError("teamMembership", null);
    }

    const orgMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: {
          userId,
          organizationId: teamMembership.team.organizationId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!orgMembership) {
      throw new ResourceNotFoundError("membership", null);
    }

    if (["owner", "manager"].includes(orgMembership.role) && role === "contributor") {
      throw new AuthorizationError(`Organization ${orgMembership.role} cannot be a contributor`);
    }

    await prisma.teamUser.update({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      data: {
        role,
      },
    });

    teamCache.revalidate({ id: teamId, userId });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const removeTeamMember = async (teamId: string, userId: string): Promise<boolean> => {
  validateInputs([teamId, ZId], [userId, ZId]);
  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        organizationId: true,
        projectTeams: {
          where: {
            teamId,
          },
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!team) {
      throw new ResourceNotFoundError("team", teamId);
    }

    const teamMembership = await prisma.teamUser.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!teamMembership) {
      throw new ResourceNotFoundError("teamMembership", null);
    }

    await prisma.teamUser.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    teamCache.revalidate({
      id: teamId,
      userId,
      organizationId: team.organizationId,
    });

    projectCache.revalidate({ userId });

    for (const projectTeam of team.projectTeams) {
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

export const getMembersByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationMember[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZString]);

        try {
          const membersData = await prisma.membership.findMany({
            where: {
              organizationId,
              role: {
                not: "billing",
              },
            },
            select: {
              user: {
                select: {
                  name: true,
                },
              },
              userId: true,
            },
          });

          const members = membersData.map((member) => {
            return {
              id: member.userId,
              name: member.user?.name || "",
            };
          });

          return members;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }

          throw new UnknownError("Error while fetching members");
        }
      },
      [`getMembersByOrganizationId-${organizationId}`],
      {
        tags: [membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const addTeamMembers = async (teamId: string, userIds: string[]): Promise<boolean> => {
  validateInputs([teamId, ZId], [userIds, z.array(ZId)]);
  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        organizationId: true,
        organization: {
          select: {
            projects: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new ResourceNotFoundError("team", teamId);
    }

    for (const userId of userIds) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: team.organizationId,
          },
        },
        select: {
          role: true,
        },
      });

      if (!membership) {
        throw new ResourceNotFoundError("Membership", null);
      }

      let role: TeamUserRole = "contributor";

      const { isOwner, isManager } = getAccessFlags(membership.role);

      if (isOwner || isManager) {
        role = "admin";
      }

      await prisma.teamUser.create({
        data: {
          teamId,
          userId,
          role,
        },
      });

      teamCache.revalidate({ userId });
      projectCache.revalidate({ userId });
    }

    for (const project of team.organization.projects) {
      teamCache.revalidate({ projectId: project.id });
    }

    projectCache.revalidate({ organizationId: team.organizationId });
    teamCache.revalidate({ id: teamId, organizationId: team.organizationId });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getTeamProjects = reactCache(
  async (teamId: string): Promise<TTeamProject[]> =>
    cache(
      async () => {
        validateInputs([teamId, ZId]);

        try {
          const projects = await prisma.projectTeam.findMany({
            where: {
              teamId,
            },
            select: {
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
              permission: true,
            },
          });

          return projects.map((project) => ({
            id: project.project.id,
            name: project.project.name,
            permission: project.permission,
          }));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getTeamProjects-${teamId}`],
      { tags: [teamCache.tag.byId(teamId)] }
    )()
);

export const updateTeamProjectPermission = async (
  teamId: string,
  projectId: string,
  permission: TTeamPermission
): Promise<boolean> => {
  validateInputs([teamId, ZId], [projectId, ZId], [permission, ZTeamPermission]);
  try {
    const projectTeam = await prisma.projectTeam.findUnique({
      where: {
        projectId_teamId: {
          projectId,
          teamId,
        },
      },
    });

    if (!projectTeam) {
      throw new ResourceNotFoundError("projectTeam", null);
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

    teamCache.revalidate({ id: teamId, projectId: projectId });
    projectCache.revalidate({ id: projectId });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const removeTeamProject = async (teamId: string, projectId: string): Promise<boolean> => {
  validateInputs([teamId, ZId], [projectId, ZId]);
  try {
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
        organizationId: true,
        environments: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!project) {
      throw new ResourceNotFoundError("project", projectId);
    }
    const projectTeam = await prisma.projectTeam.findUnique({
      where: {
        projectId_teamId: {
          projectId,
          teamId,
        },
      },
    });

    if (!projectTeam) {
      throw new ResourceNotFoundError("projectTeam", null);
    }

    await prisma.projectTeam.delete({
      where: {
        projectId_teamId: {
          projectId,
          teamId,
        },
      },
    });

    teamCache.revalidate({ id: teamId, projectId: projectId });
    projectCache.revalidate({ id: projectId, organizationId: project.organizationId });

    for (const environment of project.environments) {
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

export const getProjectsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationProject[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZString]);

        try {
          const projects = await prisma.project.findMany({
            where: {
              organizationId,
            },
            select: {
              id: true,
              name: true,
            },
          });

          return projects.map((project) => ({
            id: project.id,
            name: project.name,
          }));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }

          throw new UnknownError("Error while fetching projects");
        }
      },
      [`getProjectsByOrganizationId-${organizationId}`],
      {
        tags: [projectCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const addTeamProjects = async (teamId: string, projectIds: string[]): Promise<boolean> => {
  validateInputs([teamId, ZId], [projectIds, z.array(ZId)]);
  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        organizationId: true,
      },
    });

    if (!team) {
      throw new ResourceNotFoundError("team", teamId);
    }

    for (const projectId of projectIds) {
      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
          organizationId: team.organizationId,
        },
        select: {
          environments: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!project) {
        throw new ResourceNotFoundError("project", projectId);
      }

      const projectTeam = await prisma.projectTeam.findUnique({
        where: {
          projectId_teamId: {
            projectId,
            teamId,
          },
        },
      });

      if (projectTeam) {
        continue;
      }

      await prisma.projectTeam.create({
        data: {
          projectId,
          teamId,
          permission: "read",
        },
      });

      teamCache.revalidate({ id: teamId, projectId: projectId });
      projectCache.revalidate({ id: projectId, organizationId: team.organizationId });

      for (const environment of project.environments) {
        organizationCache.revalidate({ environmentId: environment.id });
      }
    }

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
