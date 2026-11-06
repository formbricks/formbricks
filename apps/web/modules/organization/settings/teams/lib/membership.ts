import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError, ValidationError } from "@formbricks/types/errors";
import { TMember, TMembership } from "@formbricks/types/memberships";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import { isTransactionConflictError, retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import { revokeAllUserOAuthGrants } from "@/modules/auth/lib/oauth-grant-revocation";
import { TOrganizationMember } from "@/modules/ee/teams/team-list/types/team";

/**
 * One serializable transaction, run again when Postgres aborts it over a concurrent one. Both the
 * shared conflict check and the retry live in `prisma-error`, so a driver adapter's own conflict error
 * is retried as well as Prisma's P2034.
 */
const runSerializableTransactionWithRetry = <T>(
  transaction: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(transaction, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  );

export const getMembershipByOrganizationId = reactCache(
  async (organizationId: string, page?: number): Promise<TMember[]> => {
    validateInputs([organizationId, ZString], [page, ZOptionalNumber]);

    try {
      const membersData = await prisma.membership.findMany({
        where: { organizationId },
        select: {
          user: {
            select: {
              name: true,
              email: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
          userId: true,
          accepted: true,
          role: true,
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      const members = membersData.map((member) => {
        return {
          name: member.user?.name || "",
          email: member.user?.email || "",
          userId: member.userId,
          accepted: member.accepted,
          role: member.role,
          isActive: member.user?.isActive || false,
          lastLoginAt: member.user?.lastLoginAt ?? null,
        };
      });

      return members;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error fetching membership by organization id");
        throw new DatabaseError(error.message);
      }

      throw new UnknownError("Error while fetching members");
    }
  }
);

const getOrganizationOwnerCountUncached = async (
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<number> => {
  validateInputs([organizationId, ZString]);

  try {
    const ownersCount = await (tx ?? prisma).membership.count({
      where: {
        organizationId,
        role: "owner",
        // A deactivated user can never sign in again (see modules/auth/lib/session.ts and
        // better-auth-active-user-gate.ts), so counting them as "another owner" would let a
        // guard pass while leaving the organization with no owner who can actually log in.
        user: { isActive: true },
      },
    });

    return ownersCount;
  } catch (error) {
    // Inside a transaction the error belongs to the transaction's owner: wrapping a serialization
    // conflict (P2034) here would hide it from the retry that re-runs the whole transaction.
    if (!tx && error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

const getOrganizationOwnerCountCached = reactCache((organizationId: string) =>
  getOrganizationOwnerCountUncached(organizationId)
);

/**
 * Pass `tx` when this must be read inside the same transaction as the mutation it's guarding
 * (see updateMembershipAction) so a Serializable transaction can catch concurrent demotions;
 * without `tx` the result is request-cached like the rest of this module's reads.
 */
export const getOrganizationOwnerCount = async (
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<number> => {
  if (tx) {
    return getOrganizationOwnerCountUncached(organizationId, tx);
  }

  return getOrganizationOwnerCountCached(organizationId);
};

export const deleteMembership = async (
  userId: string,
  organizationId: string
): Promise<
  {
    userId: string;
    role: "admin" | "contributor";
    teamId: string;
  }[]
> => {
  validateInputs([userId, ZString], [organizationId, ZString]);

  try {
    const deletedTeamMemberships = await runSerializableTransactionWithRetry(async (tx) => {
      // The last-owner guard is read in the same serializable transaction as the delete, so two owners
      // removed at once cannot both see "another owner is left" and leave the organization with none.
      const target = await tx.membership.findUnique({
        where: { userId_organizationId: { organizationId, userId } },
        select: { role: true, user: { select: { isActive: true } } },
      });
      if (target?.role === "owner") {
        const activeOwners = await getOrganizationOwnerCount(organizationId, tx);
        const activeOwnersLeft = activeOwners - (target.user.isActive ? 1 : 0);
        if (activeOwnersLeft < 1) {
          throw new ValidationError("You cannot delete the last owner of the organization");
        }
      }

      const teamMemberships = await tx.teamUser.findMany({
        where: {
          userId,
          team: {
            organizationId,
          },
        },
      });

      await tx.teamUser.deleteMany({
        where: {
          userId,
          team: {
            organizationId,
          },
        },
      });
      const removed = await tx.membership.delete({
        where: {
          userId_organizationId: {
            organizationId,
            userId,
          },
        },
        select: { role: true },
      });

      // Someone left with only Dashboard viewer memberships keeps no OAuth grant from the wider role they
      // just lost: consents go and refresh tokens are revoked, as when a role edit makes them a viewer
      // (`updateMembership`), so the next consent offers only dashboards:read (ADR-0025).
      if (removed.role !== "dashboard_viewer") {
        if (await isOnlyDashboardViewer(tx, userId)) {
          await revokeAllUserOAuthGrants(tx, userId);
        }
      }

      // A pending invite is only as trustworthy as the member who sent it, so once the creator is out
      // of the organization it must stop granting access. Expired rather than deleted: admins still see
      // it in the invite list and can resend it on purpose.
      const now = new Date();
      await tx.invite.updateMany({
        where: { organizationId, creatorId: userId, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });

      return teamMemberships;
    });

    await reconcileOrganizationMembership(organizationId, userId);
    await runPostCommitProjection("organization_membership_team_cleanup", () =>
      reconcileTeamWorkspaceRelationships({
        teamMemberships: deletedTeamMemberships.map(({ teamId }) => ({ teamId, userId })),
      })
    );

    return deletedTeamMemberships;
  } catch (error) {
    // A conflict that outlasted every retry may be the driver adapter's own error rather than P2034.
    if (error instanceof Prisma.PrismaClientKnownRequestError || isTransactionConflictError(error)) {
      throw new DatabaseError(error instanceof Error ? error.message : "Transaction conflict");
    }

    throw error;
  }
};

export const getMembershipsByUserId = reactCache(
  async (userId: string, page?: number): Promise<TMembership[]> => {
    validateInputs([userId, ZString], [page, ZOptionalNumber]);

    try {
      const memberships = await prisma.membership.findMany({
        where: {
          userId,
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      return memberships;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getMembersByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationMember[]> => {
    validateInputs([organizationId, ZString]);

    try {
      const membersData = await prisma.membership.findMany({
        where: { organizationId },
        select: {
          user: {
            select: {
              name: true,
            },
          },
          role: true,
          userId: true,
        },
      });

      const members = membersData.map((member) => {
        return {
          id: member.userId,
          name: member.user?.name || "",
          role: member.role,
        };
      });

      return members;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
