import { teamCache } from "@/lib/cache/team";
import { getUsersQuery } from "@/modules/api/v2/organizations/[organizationId]/users/lib/utils";
import {
  TGetUsersFilter,
  TUserInput,
  TUserInputPatch,
} from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { OrganizationRole, Prisma, TeamUserRole } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { TNoBillingOrganizationRoles, TUser } from "@formbricks/database/zod/users";
import { membershipCache } from "@formbricks/lib/membership/cache";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { userCache } from "@formbricks/lib/user/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getUsers = async (
  organizationId: string,
  params: TGetUsersFilter
): Promise<Result<ApiResponseWithMeta<TUser[]>, ApiErrorResponseV2>> => {
  try {
    const [users, count] = await prisma.$transaction([
      prisma.user.findMany({
        ...getUsersQuery(organizationId, params),
        include: {
          teamUsers: {
            include: {
              team: true,
            },
          },
        },
      }),
      prisma.user.count({
        where: getUsersQuery(organizationId, params).where,
      }),
    ]);

    if (!users) {
      return err({ type: "not_found", details: [{ field: "users", issue: "not found" }] });
    }

    const returnedUsers = users.map(
      (user) =>
        ({
          id: user.id,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          email: user.email,
          name: user.name,
          // lastLoginAt: user.lastLoginAt,
          lastLoginAt: new Date(),
          // isActive: user.isActive,
          isActive: true,
          role: user.role as TNoBillingOrganizationRoles,
          teams: user.teamUsers.map((teamUser) => teamUser.team.name),
        }) as TUser
    );

    return ok({
      data: returnedUsers,
      meta: {
        total: count,
        limit: params.limit,
        offset: params.skip,
      },
    });
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "users", issue: error.message }] });
  }
};

export const createUser = async (
  userInput: TUserInput,
  organizationId
): Promise<Result<TUser, ApiErrorResponseV2>> => {
  captureTelemetry("user created");

  const { name, email, role, isActive } = userInput;

  try {
    const { existingTeams, teamUsersToCreate } = await getTeamsFromInput(userInput, organizationId);

    const prismaData: Prisma.UserCreateInput = {
      name,
      email,
      // isActive: isActive ?? false,
      memberships: {
        create: {
          accepted: true, // auto accept because there is no invite
          role: role.toLowerCase() as OrganizationRole,
          organization: {
            connect: {
              id: organizationId,
            },
          },
        },
      },
      teamUsers:
        existingTeams?.length > 0
          ? {
              create: teamUsersToCreate,
            }
          : undefined,
    };

    const user = await prisma.user.create({
      data: prismaData,
      include: {
        memberships: {
          select: {
            role: true,
            organizationId: true,
          },
        },
      },
    });

    if (existingTeams?.length > 0) {
      for (const team of existingTeams) {
        teamCache.revalidate({
          id: team.id,
          organizationId: organizationId,
        });

        for (const projectTeam of team.projectTeams) {
          teamCache.revalidate({
            projectId: projectTeam.projectId,
          });
        }
      }
    }

    // revalidate membership cache
    membershipCache.revalidate({
      organizationId: organizationId,
      userId: user.id,
    });

    const returnedUser = {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      email: user.email,
      name: user.name,
      // lastLoginAt: user.lastLoginAt,
      lastLoginAt: new Date(),
      // isActive: user.isActive,
      isActive: true,
      role: user.memberships.filter((membership) => membership.organizationId === organizationId)[0].role,
      teams: existingTeams ? existingTeams.map((team) => team.name) : [],
    } as TUser;

    return ok(returnedUser);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "user", issue: error.message }] });
  }
};

export const updateUser = async (
  userInput: TUserInputPatch,
  organizationId: string
): Promise<Result<TUser, ApiErrorResponseV2>> => {
  captureTelemetry("user updated");

  const { name, email, role, isActive } = userInput;

  try {
    // check the teams that the user is part of and remove the ones that are not in the input
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          select: {
            role: true,
            organizationId: true,
          },
        },
        teamUsers: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!existingUser) {
      return err({ type: "not_found", details: [{ field: "user", issue: "not found" }] });
    }

    // check if the user's teams changed in the input
    const existingTeams = existingUser.teamUsers
      .map((teamUser) => teamUser.team)
      .forEach((team) => {
        if (!userInput.teams?.includes(team.name)) {
          // remove the team from the user
          prisma.teamUser.delete({
            where: {
              userId: existingUser.id,
              teamId: team.id,
            },
          });

          teamCache.revalidate({
            id: team.id,
            organizationId: organizationId,
          });

          for (const projectTeam of team.projectTeams) {
            teamCache.revalidate({
              projectId: projectTeam.projectId,
            });
          }
        }
      });

    const prismaData: Prisma.UserUpdateInput = {
      name: name ?? undefined,
      email: email ?? undefined,
      // isActive: isActive ?? undefined,
      memberships: {
        updateMany: {
          where: {
            organizationId,
          },
          data: {
            role: role ? (role.toLowerCase() as OrganizationRole) : undefined,
          },
        },
      },
      teamUsers:
        existingTeams?.length > 0
          ? {
              createMany: { data: teamUsersToCreate },
            }
          : undefined,
    };

    const user = await prisma.user.update({
      where: { email },
      data: prismaData,
      include: {
        memberships: {
          select: {
            role: true,
            organizationId: true,
          },
        },
      },
    });

    if (existingTeams?.length > 0) {
      for (const team of existingTeams) {
        teamCache.revalidate({
          id: team.id,
          organizationId,
        });

        for (const projectTeam of team.projectTeams) {
          teamCache.revalidate({
            projectId: projectTeam.projectId,
          });
        }
      }
    }

    // revalidate membership cache
    membershipCache.revalidate({
      organizationId,
      userId: user.id,
    });

    // revalidate user cache
    userCache.revalidate({
      id: user.id,
      email: user.email,
    });

    const returnedUser = {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      email: user.email,
      name: user.name,
      // lastLoginAt: user.lastLoginAt,
      lastLoginAt: new Date(),
      // isActive: user.isActive,
      isActive: true,
      role: user.memberships.filter((membership) => membership.organizationId === organizationId)[0].role,
      teams: existingTeams ? existingTeams.map((team) => team.name) : [],
    } as TUser;
    return ok(returnedUser);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "user", issue: error.message }] });
  }
};

const getTeamsFromInput = async (userInput: TUserInput | TUserInputPatch, organizationId: string) => {
  let existingTeams;

  if (userInput.teams) {
    existingTeams = await prisma.team.findMany({
      where: {
        name: { in: userInput.teams },
        organizationId,
      },
      select: {
        id: true,
        name: true,
        projectTeams: {
          select: {
            projectId: true,
          },
        },
      },
    });
  }

  let teamUsersToCreate;

  if (existingTeams) {
    teamUsersToCreate = existingTeams.map((team) => ({
      role: TeamUserRole.contributor,
      team: {
        connect: {
          id: team.id,
        },
      },
    }));
  }

  return { existingTeams, teamUsersToCreate };
};
