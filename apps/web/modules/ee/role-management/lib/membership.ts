import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZString } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TMembership, TMembershipUpdateInput, ZMembershipUpdateInput } from "@formbricks/types/memberships";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import { validateInputs } from "@/lib/utils/validate";
import { finishRevokedMcpGrants, revokeAllUserOAuthGrants } from "@/modules/auth/lib/mcp-grant-revocation";
import type { TMcpGrantAuditRecord } from "@/modules/mcp/grant-audit";

/**
 * How far a role change got, recorded as it goes, so a caller still knows when a later write fails: whether
 * the role was written, the audit records of the MCP grants it ended, and the teams it reaches.
 */
type TMembershipRoleChangeProgress = {
  membershipUpdated: boolean;
  endedGrantAudits: TMcpGrantAuditRecord[];
  affectedTeamIds: string[];
};

const startRoleChangeProgress = (): TMembershipRoleChangeProgress => ({
  membershipUpdated: false,
  endedGrantAudits: [],
  affectedTeamIds: [],
});

/** The writes of a role change, on `client`, recording each step in `progress`. */
const writeMembershipRoleChange = async (
  client: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  data: TMembershipUpdateInput,
  progress: TMembershipRoleChangeProgress
): Promise<TMembership> => {
  try {
    const membership = await client.membership.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      data,
    });
    progress.membershipUpdated = true;

    if (data.role === "owner" || data.role === "manager") {
      await client.teamUser.updateMany({
        where: {
          userId,
          team: {
            organizationId,
          },
        },
        data: {
          role: "admin",
        },
      });
    }

    // A Dashboard viewer can't be a team admin: a team admin manages the team's members and invites
    // others, which the role must never do (ADR-0025). The teams themselves stay, since they are what
    // grants the viewer its workspaces.
    if (data.role === "dashboard_viewer") {
      await client.teamUser.updateMany({
        where: { userId, role: "admin", team: { organizationId } },
        data: { role: "contributor" },
      });

      // Someone who is now only ever a Dashboard viewer keeps no OAuth grant from a wider role: their
      // consents go and their refresh tokens are revoked, so the next authorization passes through a
      // consent that offers only dashboards:read, and no refresh mints a wider token.
      if (await isOnlyDashboardViewer(client, userId)) {
        const { grantAudits } = await revokeAllUserOAuthGrants(client, userId);
        progress.endedGrantAudits.push(...grantAudits);
      }
    }

    const teamMemberships = await client.teamUser.findMany({
      where: {
        userId,
        team: {
          organizationId,
        },
      },
      select: {
        teamId: true,
      },
    });

    progress.affectedTeamIds = teamMemberships.map(({ teamId }) => teamId);

    await client.membership.findMany({
      where: {
        organizationId,
      },
      select: {
        userId: true,
      },
    });

    return membership;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === PrismaErrorType.RelatedRecordNotFound || error.code === PrismaErrorType.RecordNotFound)
    ) {
      throw new ResourceNotFoundError("Membership", `userId: ${userId}, organizationId: ${organizationId}`);
    }

    throw error;
  }
};

/**
 * Projects a committed role change to SpiceDB: the user's organization role, and their team relationships
 * in `teamIds`. Runs after the source commit, so it reads the new role. Never throws: a failure is logged
 * and left to the durable outbox, which projects the same change.
 */
export const projectMembershipRoleChange = async (
  organizationId: string,
  userId: string,
  teamIds: string[]
): Promise<void> => {
  await runPostCommitProjection("organization_role_membership_update", () =>
    reconcileOrganizationMembership(organizationId, userId)
  );
  await runPostCommitProjection("organization_role_team_membership_update", () =>
    reconcileTeamWorkspaceRelationships({
      teamMemberships: teamIds.map((teamId) => ({ teamId, userId })),
    })
  );
};

/**
 * Sets a member's role. `actorUserId` is the user making the change: the actor of the audit entries of any
 * MCP grant the change ends.
 */
export const updateMembership = async (
  userId: string,
  organizationId: string,
  data: TMembershipUpdateInput,
  actorUserId: string
): Promise<TMembership> => {
  validateInputs([userId, ZString], [organizationId, ZString], [data, ZMembershipUpdateInput]);
  const progress = startRoleChangeProgress();

  try {
    return await writeMembershipRoleChange(prisma, userId, organizationId, data, progress);
  } finally {
    // Outside a transaction each write commits on its own, so what was written before a later write failed
    // stays all the same: the role is projected, then its ended grants are audited and removed from SpiceDB.
    // The role first: it is what the user could still act on, and finishing the grants can't then delay it.
    if (progress.membershipUpdated) {
      await projectMembershipRoleChange(organizationId, userId, progress.affectedTeamIds);
    }
    await finishRevokedMcpGrants(progress.endedGrantAudits, { actorUserId });
  }
};

/**
 * Sets a member's role in the caller's transaction, and returns the audit records of the MCP grants it
 * ended and the user's teams in the organization. Once that transaction has committed, the caller passes
 * the records to `finishRevokedMcpGrants`, with the user who made the change as the actor, and the teams to
 * `projectMembershipRoleChange`; a retried attempt's results are dropped with the attempt. Nothing is
 * projected from inside the transaction: reading through the global client there could observe the
 * pre-commit role and would publish stale relationships.
 */
export const updateMembershipInTransaction = async (
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  data: TMembershipUpdateInput
): Promise<{ membership: TMembership; grantAudits: TMcpGrantAuditRecord[]; affectedTeamIds: string[] }> => {
  validateInputs([userId, ZString], [organizationId, ZString], [data, ZMembershipUpdateInput]);
  const progress = startRoleChangeProgress();
  const membership = await writeMembershipRoleChange(tx, userId, organizationId, data, progress);
  return { membership, grantAudits: progress.endedGrantAudits, affectedTeamIds: progress.affectedTeamIds };
};
