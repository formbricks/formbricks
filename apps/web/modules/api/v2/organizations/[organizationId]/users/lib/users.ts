import { captureTelemetry } from "@/lib/telemetry";
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
import { TUser } from "@formbricks/database/zod/users";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getUsers = async (
  organizationId: string,
  params: TGetUsersFilter
): Promise<Result<ApiResponseWithMeta<TUser[]>, ApiErrorResponseV2>> => {
  try {
    const query = getUsersQuery(organizationId, params);

    const [users, count] = await prisma.$transaction([
      prisma.user.findMany({
        ...query,
        include: {
          teamUsers: {
            include: {
              team: true,
            },
          },
          memberships: {
            select: {
              role: true,
              organizationId: true,
            },
          },
        },
      }),
      prisma.user.count({
        where: query.where,
      }),
    ]);

    const returnedUsers = users.map(
      (user) =>
        ({
          id: user.id,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          lastLoginAt: user.lastLoginAt,
          isActive: user.isActive,
          role: user.memberships.filter((membership) => membership.organizationId === organizationId)[0].role,
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

  const { name, email, role, teams, isActive } = userInput;

  try {
    const existingTeams = teams && (await getExistingTeamsFromInput(teams, organizationId));

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

    // Split name into firstName and lastName
    const nameParts = name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const prismaData: Prisma.UserCreateInput = {
      firstName,
      lastName,
      email,
      isActive: isActive,
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

    const returnedUser = {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
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

  const { name, email, role, teams, isActive } = userInput;
  let existingTeams: string[] = [];
  let newTeams;

  try {
    // First, fetch the existing user along with memberships and teamUsers.
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
      return err({
        type: "not_found",
        details: [{ field: "user", issue: "not found" }],
      });
    }

    // Capture the existing team names for the user.
    existingTeams = existingUser.teamUsers.map((teamUser) => teamUser.team.name);

    // Build an array of operations for deleting teamUsers that are not in the input.
    const deleteTeamOps = [] as Prisma.PrismaPromise<any>[];
    existingUser.teamUsers.forEach((teamUser) => {
      if (teams && !teams?.includes(teamUser.team.name)) {
        deleteTeamOps.push(
          prisma.teamUser.delete({
            where: {
              teamId_userId: {
                teamId: teamUser.team.id,
                userId: existingUser.id,
              },
            },
            include: {
              team: {
                include: {
                  projectTeams: {
                    select: { projectId: true },
                  },
                },
              },
            },
          })
        );
      }
    });

    // Look up teams from the input that exist in this organization.
    newTeams = await getExistingTeamsFromInput(teams, organizationId);
    const existingUserTeamNames = existingUser.teamUsers.map((teamUser) => teamUser.team.name);

    // Build an array of operations for creating new teamUsers.
    const createTeamOps = [] as Prisma.PrismaPromise<any>[];
    newTeams?.forEach((team) => {
      if (!existingUserTeamNames.includes(team.name)) {
        createTeamOps.push(
          prisma.teamUser.create({
            data: {
              role: TeamUserRole.contributor,
              user: { connect: { id: existingUser.id } },
              team: { connect: { id: team.id } },
            },
            include: {
              team: {
                include: {
                  projectTeams: {
                    select: { projectId: true },
                  },
                },
              },
            },
          })
        );
      }
    });

    // Split name into firstName and lastName if provided
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (name) {
      const nameParts = name.split(" ");
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || "";
    }

    const prismaData: Prisma.UserUpdateInput = {
      firstName: firstName ?? undefined,
      lastName: lastName ?? undefined,
      email: email ?? undefined,
      isActive: isActive ?? undefined,
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
    };

    // Build the user update operation.
    const updateUserOp = prisma.user.update({
      where: { email },
      data: prismaData,
      include: {
        memberships: {
          select: { role: true, organizationId: true },
        },
      },
    });

    // Combine all operations into one transaction.
    const operations = [...deleteTeamOps, ...createTeamOps, updateUserOp];

    // Execute the transaction. The result will be an array with the results in the same order.
    const results = await prisma.$transaction(operations);

    // Retrieve the updated user result. Since the update was the last operation, it is the last item.
    const updatedUser = results[results.length - 1];

    const returnedUser = {
      id: updatedUser.id,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      email: updatedUser.email,
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      lastLoginAt: updatedUser.lastLoginAt,
      isActive: updatedUser.isActive,
      role: updatedUser.memberships.find(
        (m: { organizationId: string }) => m.organizationId === organizationId
      )?.role,
      teams: newTeams ? newTeams.map((team) => team.name) : existingTeams,
    };

    return ok(returnedUser);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "user", issue: error.message }],
    });
  }
};

const getExistingTeamsFromInput = async (userInputTeams: string[] | undefined, organizationId: string) => {
  let existingTeams;

  if (userInputTeams) {
    existingTeams = await prisma.team.findMany({
      where: {
        name: { in: userInputTeams },
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

  return existingTeams;
};
