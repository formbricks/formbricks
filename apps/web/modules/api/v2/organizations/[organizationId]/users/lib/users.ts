import { prisma } from "@formbricks/database";
import { OrganizationRole, Prisma, TeamUserRole } from "@formbricks/database/prisma";
import { TUser } from "@formbricks/database/zod/users";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { lockUserActiveState, reactivateLockedUser } from "@/lib/user/reactivation";
import { isUniqueConstraintError } from "@/lib/utils/prisma-constraint";
import { getUsersQuery } from "@/modules/api/v2/organizations/[organizationId]/users/lib/utils";
import {
  TGetUsersFilter,
  TUserInput,
  TUserInputPatch,
} from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { ApiErrorDetails, ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { getOrganizationOwnerCount } from "@/modules/organization/settings/teams/lib/membership";

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
          name: user.name,
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
    return err({
      type: "internal_server_error",
      details: [{ field: "users", issue: error instanceof Error ? error.message : "Unknown error occurred" }],
    });
  }
};

export const createUser = async (
  userInput: TUserInput,
  organizationId: string
): Promise<Result<TUser, ApiErrorResponseV2>> => {
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

    const prismaData: Prisma.UserCreateInput = {
      name,
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
        existingTeams && existingTeams.length > 0
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

    await reconcileOrganizationMembership(organizationId, user.id);
    await runPostCommitProjection("api_v2_organization_user_create", () =>
      reconcileTeamWorkspaceRelationships({
        teamMemberships: (existingTeams ?? []).map(({ id: teamId }) => ({ teamId, userId: user.id })),
      })
    );

    const returnedUser = {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      email: user.email,
      name: user.name,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
      role: user.memberships.filter((membership) => membership.organizationId === organizationId)[0].role,
      teams: existingTeams ? existingTeams.map((team) => team.name) : [],
    } as TUser;

    return ok(returnedUser);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // `email` is the only user-facing unique constraint on this create, so map any P2002 to a
      // conflict rather than gating on the (adapter-dependent) field list — this can never 500.
      return err({
        type: "conflict",
        details: [{ field: "email", issue: "A user with this email already exists" }],
      });
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "user", issue: error instanceof Error ? error.message : "Unknown error occurred" }],
    });
  }
};

// Thrown inside updateUser's transaction to carry the last-owner conflict out through the
// generic catch block below without it being reported as an internal_server_error.
class LastOwnerConflictError extends Error {}

// Thrown inside updateUser's transaction when the request would change an account-wide field of a
// user who also belongs to another organization; carried out as a 409, like LastOwnerConflictError:
// the same request succeeds for a user in this organization alone, so it conflicts with the user's
// current state rather than being malformed.
class AccountFieldsConflictError extends Error {
  constructor(readonly details: ApiErrorDetails) {
    super("Cannot change the account-wide fields of this user from this organization");
  }
}

const OTHER_ORGANIZATIONS_ISSUE =
  "cannot be changed from one organization while the user also belongs to other organizations";

/**
 * `name` and `isActive` belong to the account, not to this organization's membership: changing them here
 * changes them in every other organization the user belongs to, and deactivating locks the user out of
 * all of them. So only an organization the user belongs to alone may change them, as the data retention
 * members policy and Reactivate in the member list already require. Sending the stored value is no
 * change and stays allowed, so a client that echoes the whole user back keeps working.
 *
 * Decided under the user row's lock (`lockUserActiveState`), which a membership being added in another
 * organization waits on, so one added meanwhile is counted. Returns whether the account was active.
 */
const lockAndCheckAccountFields = async (
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  { name, isActive }: Pick<TUserInputPatch, "name" | "isActive">
): Promise<{ wasActive: boolean }> => {
  await lockUserActiveState(tx, userId);
  const account = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      isActive: true,
      memberships: {
        where: { organizationId: { not: organizationId } },
        select: { organizationId: true },
        take: 1,
      },
    },
  });

  const changedFields: ("isActive" | "name")[] = [];
  if (isActive !== undefined && isActive !== account.isActive) changedFields.push("isActive");
  if (name !== undefined && name !== account.name) changedFields.push("name");

  if (account.memberships.length > 0 && changedFields.length > 0) {
    throw new AccountFieldsConflictError(
      changedFields.map((field) => ({ field, issue: OTHER_ORGANIZATIONS_ISSUE }))
    );
  }

  return { wasActive: account.isActive };
};

export const updateUser = async (
  userInput: TUserInputPatch,
  organizationId: string
): Promise<Result<TUser, ApiErrorResponseV2>> => {
  const { name, email, role, teams, isActive } = userInput;
  let existingTeams: string[] = [];
  let newTeams: Awaited<ReturnType<typeof getExistingTeamsFromInput>>;

  try {
    // Restrict the lookup to a user with a membership in the authenticated organization,
    // and scope teamUsers to teams that belong to the same organization. Looking up by
    // email alone would surface users from other organizations and allow mutations to
    // their global fields and team memberships.
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        memberships: { some: { organizationId } },
      },
      include: {
        memberships: {
          select: {
            role: true,
            organizationId: true,
          },
        },
        teamUsers: {
          where: { team: { organizationId } },
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

    const currentRole = existingUser.memberships.find(
      (membership) => membership.organizationId === organizationId
    )?.role;

    // Mirrors the last-owner guard in modules/ee/role-management/actions.ts: without it, this
    // route can demote an organization's only owner with no UI path back into it. Gated on
    // existingUser.isActive because getOrganizationOwnerCount only counts active owners — demoting
    // an already-inactive owner doesn't change that count, so guarding it would block a no-op change.
    const isDemotingOwner =
      currentRole === OrganizationRole.owner &&
      existingUser.isActive &&
      role &&
      role !== OrganizationRole.owner;

    // Capture the existing team names for the user (within the authenticated organization).
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
                  workspaceTeams: {
                    select: { workspaceId: true },
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
                  workspaceTeams: {
                    select: { workspaceId: true },
                  },
                },
              },
            },
          })
        );
      }
    });

    // `email` is how the user was found, so it is never written: another account-wide field this
    // organization has no business changing.
    const prismaData: Prisma.UserUpdateInput = {
      name: name ?? undefined,
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

    // Matches the pre-existing looseness of `results: any[]` from the array-style transaction
    // below rather than introducing a stricter type here that the rest of this function's
    // (already loosely-typed) User <-> TUser mapping isn't written to satisfy.
    let updatedUser: any;

    const touchesAccountFields = name !== undefined || isActive !== undefined;

    if (isDemotingOwner || touchesAccountFields) {
      // The owner-count re-check and the role write must be one atomic unit: read then act in two
      // separate statements lets two callers demoting different owners at once both read "more
      // than one owner" and both writes land, leaving none. Serializable isolation makes Postgres
      // abort one side of that race instead, surfaced here as a thrown LastOwnerConflictError.
      //
      // A change to the account's own fields is decided under the user row's lock
      // (`lockAndCheckAccountFields`). A false→true change then goes through `reactivateLockedUser`,
      // like Reactivate in the member list, so the data retention members clock restarts and the old
      // notice is cleared. Without it the member would be deactivated again the next night, with no
      // warning.
      updatedUser = await prisma.$transaction(
        async (tx) => {
          const account = touchesAccountFields
            ? await lockAndCheckAccountFields(tx, existingUser.id, organizationId, { name, isActive })
            : null;
          const reactivating = isActive === true && account?.wasActive === false;
          // When an owner is also being demoted this transaction is Serializable, so the membership
          // read in lockAndCheckAccountFields uses the snapshot taken before the row lock was granted:
          // a membership another organization was adding while we waited is not seen. That ends the
          // same as this change landing just before the membership did, which this organization was
          // entitled to do, so it is accepted rather than splitting the request across transactions.
          if (isDemotingOwner) {
            const ownerCount = await getOrganizationOwnerCount(organizationId, tx);
            if (ownerCount <= 1) {
              throw new LastOwnerConflictError();
            }
          }

          // Re-run against `tx` rather than reusing deleteTeamOps/createTeamOps below: those are
          // built against the root client, so awaiting them here would run them as separate
          // queries outside this transaction instead of as part of it.
          for (const teamUser of existingUser.teamUsers) {
            if (teams && !teams.includes(teamUser.team.name)) {
              await tx.teamUser.delete({
                where: {
                  teamId_userId: { teamId: teamUser.team.id, userId: existingUser.id },
                },
              });
            }
          }
          for (const team of newTeams ?? []) {
            if (!existingUserTeamNames.includes(team.name)) {
              await tx.teamUser.create({
                data: {
                  role: TeamUserRole.contributor,
                  user: { connect: { id: existingUser.id } },
                  team: { connect: { id: team.id } },
                },
              });
            }
          }

          // Update by id so the mutation is bound to the org-scoped lookup above. Email is
          // a global unique key and using it here would defeat the membership check.
          const user = await tx.user.update({
            where: { id: existingUser.id },
            data: prismaData,
            include: {
              memberships: {
                select: { role: true, organizationId: true },
              },
            },
          });
          if (reactivating) await reactivateLockedUser(tx, existingUser.id);
          return user;
        },
        isDemotingOwner ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : undefined
      );
    } else {
      // Update by id so the mutation is bound to the org-scoped lookup above. Email is
      // a global unique key and using it here would defeat the membership check.
      const updateUserOp = prisma.user.update({
        where: { id: existingUser.id },
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
      updatedUser = results.at(-1);
    }

    await reconcileOrganizationMembership(organizationId, updatedUser.id);
    const affectedTeamIds = new Set([
      ...existingUser.teamUsers.map(({ team }) => team.id),
      ...(newTeams ?? []).map(({ id }) => id),
    ]);
    await runPostCommitProjection("api_v2_organization_user_update", () =>
      reconcileTeamWorkspaceRelationships({
        teamMemberships: [...affectedTeamIds].map((teamId) => ({ teamId, userId: updatedUser.id })),
      })
    );

    const returnedUser = {
      id: updatedUser.id,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      email: updatedUser.email,
      name: updatedUser.name,
      lastLoginAt: updatedUser.lastLoginAt,
      isActive: updatedUser.isActive,
      role: updatedUser.memberships.find(
        (m: { organizationId: string }) => m.organizationId === organizationId
      )?.role,
      teams: newTeams ? newTeams.map((team) => team.name) : existingTeams,
    };

    return ok(returnedUser);
  } catch (error) {
    if (error instanceof LastOwnerConflictError) {
      return err({
        type: "conflict",
        details: [{ field: "role", issue: "Cannot remove the last owner of the organization" }],
      });
    }
    if (error instanceof AccountFieldsConflictError) {
      return err({ type: "conflict", details: error.details });
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "user", issue: error instanceof Error ? error.message : "Unknown error occurred" }],
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
        workspaceTeams: {
          select: {
            workspaceId: true,
          },
        },
      },
    });
  }

  return existingTeams;
};
