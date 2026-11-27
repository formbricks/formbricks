import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import { ValidationError } from "@formbricks/types/errors";
import type { TMembership, TOrganizationRole } from "@formbricks/types/memberships";
import {
  requireOrgActionAccess,
  requireUserManagementAccess,
} from "@/app/api/internal/lib/organization-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemConflict,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS } from "@/lib/authzed/mcp-grant-timeouts";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { canManageUsers } from "@/lib/membership/user-management";
import { lockUserActiveState } from "@/lib/user/reactivation";
import { finishRevokedMcpGrants } from "@/modules/auth/lib/mcp-grant-revocation";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  refuseRoleAssignment,
  requireRoleManagementEntitlement,
} from "@/modules/ee/role-management/lib/api-access";
import {
  projectMembershipRoleChange,
  updateMembership,
  updateMembershipInTransaction,
} from "@/modules/ee/role-management/lib/membership";
import { OWNER_ROLE_CHANGE_DETAIL } from "@/modules/ee/role-management/lib/permission";
import { deleteMembership } from "@/modules/organization/settings/teams/lib/membership";
import {
  LastActiveOwnerError,
  runOwnerGuardedTransaction,
} from "@/modules/organization/settings/teams/lib/owner-guard";
import type { TMemberUpdateBody } from "../schemas";
import { serializeMemberRole } from "../serializers";

export const LAST_OWNER_DETAIL = "You cannot demote the last owner of the organization";
export const OWN_ROLE_DETAIL = "You cannot change your own role";

/** Thrown inside the role change's transaction to roll it back: a non-owner is changing an owner's role. */
class OwnerRoleChangeRefusedError extends Error {}

/**
 * The member's role as it is now, with their membership row locked until `tx` ends: a promotion that
 * commits first is seen, and one that comes after waits for this change.
 */
const lockMembershipRole = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string
): Promise<TOrganizationRole | undefined> => {
  const [row] = await tx.$queryRaw<{ role: TOrganizationRole }[]>`
    SELECT "role" FROM "Membership"
    WHERE "organizationId" = ${organizationId} AND "userId" = ${userId}
    FOR UPDATE
  `;
  return row?.role;
};

/**
 * Change the role, demoting an owner only while another active owner remains, as the member list's server
 * action did (ENG-6767). `runOwnerGuardedTransaction` takes the owners' lock that every last-owner check
 * takes, so of two owners demoting each other at once the second waits, then counts what the first
 * committed, and is refused. The user's row is locked next, as removing a member locks it: a demotion to
 * Dashboard viewer decides whether only viewer memberships remain (and revokes the wider OAuth grants), and
 * must see a removal from another organization that commits at the same moment.
 *
 * Whether the change takes an owner out is decided under that lock, from the role read there, not from the
 * lookup the caller made before it (ENG-2177): a member that lookup saw may have been made an owner since,
 * and every other owner taken out, so only a change to `owner` can skip the guard. For the same reason the
 * rule that only an owner changes an owner's role is checked again on the locked row when `assignerRole`
 * isn't an owner (a manager never gives `owner`, so their changes always come here). `actorUserId` is the
 * user making the change: the actor of the audit entries of any MCP grant it ends (a demotion to Dashboard
 * viewer ends them), which are finished once the transaction commits. Each attempt returns its own records,
 * so a retried attempt's are dropped.
 */
const applyRoleChange = async (
  target: TMembership,
  body: TMemberUpdateBody,
  { actorUserId, assignerRole }: { actorUserId: string; assignerRole: TOrganizationRole }
): Promise<TMembership | LastActiveOwnerError | OwnerRoleChangeRefusedError> => {
  const { userId, organizationId } = target;
  if (body.role === "owner") {
    return updateMembership(userId, organizationId, body, actorUserId);
  }

  try {
    const { membership, grantAudits, affectedTeamIds } = await runOwnerGuardedTransaction(
      organizationId,
      userId,
      async (tx) => {
        // After the owners' lock, before the user's row and their MCP grant and consent rows.
        if (assignerRole !== "owner" && (await lockMembershipRole(tx, organizationId, userId)) === "owner") {
          throw new OwnerRoleChangeRefusedError();
        }
        await lockUserActiveState(tx, userId);
        return updateMembershipInTransaction(tx, userId, organizationId, body);
      },
      // Ending the user's MCP grants can wait on a reconciling pass.
      { timeout: MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS }
    );
    // The new role reaches SpiceDB right after the commit, as in every other role change: left to the outbox,
    // the demoted user would keep the owner's permissions until it delivers (ENG-7282). The role first, as it
    // is what the demoted user could still act on; the projection logs its own failures and never throws.
    await projectMembershipRoleChange(organizationId, userId, affectedTeamIds);
    await finishRevokedMcpGrants(grantAudits, { actorUserId });
    return membership;
  } catch (error) {
    if (error instanceof LastActiveOwnerError || error instanceof OwnerRoleChangeRefusedError) return error;
    throw error;
  }
};

/**
 * `PATCH /api/internal/members/{userId}?organizationId=`: change a member's organization role.
 *
 * The caller must be a member with `organization.manage_access` (user management, per
 * `USER_MANAGEMENT_MINIMUM_ROLE`) and `organization.manage`. The role rules are `assertCanAssignRole`'s
 * (managers give only the roles they may and may not touch an owner; billing is Cloud-only; the Dashboard
 * viewer role needs its plan); nobody changes their own role, as the members page never offers it
 * (ENG-2177); the last active owner can't be demoted; and the role management licence applies. A missing
 * member gets the same 403 as one in an organization the caller can't see.
 */
export async function updateMemberRoleOperation({
  authentication,
  userId,
  organizationId,
  body,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  userId: string;
  organizationId: string;
  body: TMemberUpdateBody;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = `${userId}-${organizationId}`;
  }

  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  const callerMembership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
  if (!callerMembership) return problemForbidden(requestId, undefined, instance);

  // `canManageUsers` is the user-management floor (`USER_MANAGEMENT_MINIMUM_ROLE`), the same question every
  // user-management entry point asks. `organization.manage` is a different capability, also
  // required, so both stay. Neither depends on the other, so both are asked at once; a missing user
  // management still answers first, with its reason — the caller is a member, so naming it reveals nothing.
  const [canManageAccess, access] = await Promise.all([
    canManageUsers(actor.id, organizationId),
    requireOrgActionAccess({
      authentication,
      organizationId,
      action: "organization.manage",
      requestId,
      instance,
    }),
  ]);
  if (!canManageAccess) {
    return problemForbidden(requestId, "User management is not allowed for your role", instance);
  }
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  // A sole owner demoting themselves would leave an organization no one in it can repair: managers can't
  // make an owner, and only an owner may change an owner's role.
  if (userId === actor.id) return problemForbidden(requestId, OWN_ROLE_DETAIL, instance);

  const target = await getMembershipByUserIdOrganizationId(userId, organizationId);
  const refused = await refuseRoleAssignment({
    organizationId,
    assignerRole: callerMembership.role,
    roles: [body.role],
    targetCurrentRole: target?.role,
    requestId,
    instance,
  });
  if (refused) return refused;

  const notEntitled = await requireRoleManagementEntitlement({ organizationId, requestId, instance });
  if (notEntitled) return notEntitled;

  if (!target) return problemForbidden(requestId, undefined, instance);
  if (auditLog) auditLog.oldObject = target;

  const result = await applyRoleChange(target, body, {
    actorUserId: actor.id,
    assignerRole: callerMembership.role,
  });
  if (result instanceof LastActiveOwnerError) {
    return problemConflict(requestId, LAST_OWNER_DETAIL, instance);
  }
  if (result instanceof OwnerRoleChangeRefusedError) {
    return problemForbidden(requestId, OWNER_ROLE_CHANGE_DETAIL, instance);
  }

  if (auditLog) auditLog.newObject = result;
  return successResponse(serializeMemberRole(result), { requestId });
}

/**
 * Remove a membership, mapping the last-owner guard `deleteMembership` runs under the owners' lock
 * (`runOwnerGuardedTransaction`, where two concurrent removals can't both pass it) to a 409 with its reason.
 * `actorUserId` is the user removing it (the member themselves when leaving): the actor of the audit entries
 * of the MCP grants the removal ends.
 */
export async function deleteMembershipOrConflict(
  userId: string,
  organizationId: string,
  actorUserId: string,
  { requestId, instance }: { requestId: string; instance?: string }
): Promise<Response | null> {
  try {
    await deleteMembership(userId, organizationId, actorUserId);
    return null;
  } catch (error) {
    if (error instanceof ValidationError) return problemConflict(requestId, error.message, instance);
    throw error;
  }
}

/**
 * `DELETE /api/internal/members/{userId}?organizationId=`: remove a member from the organization. The caller
 * must be above the user-management floor with `organization.manage`, can't remove themselves (leaving is
 * `DELETE /api/internal/members/me`), and a manager can't remove an owner. The last active owner stays. A
 * missing member gets the same 403 as one in an organization the caller can't see.
 */
export async function deleteMemberOperation({
  authentication,
  userId,
  organizationId,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  userId: string;
  organizationId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = `${userId}-${organizationId}`;
  }

  const access = await requireUserManagementAccess({ authentication, organizationId, requestId, instance });
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  if (userId === access.userId) {
    return problemForbidden(requestId, "You cannot delete yourself from the organization", instance);
  }

  const callerMembership = await getMembershipByUserIdOrganizationId(access.userId, organizationId);
  if (!callerMembership) return problemForbidden(requestId, undefined, instance);

  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership) return problemForbidden(requestId, undefined, instance);

  if (callerMembership.role === "manager" && membership.role === "owner") {
    return problemForbidden(requestId, "You cannot delete the owner of the organization", instance);
  }

  if (auditLog) auditLog.oldObject = membership;
  const conflict = await deleteMembershipOrConflict(userId, organizationId, access.userId, {
    requestId,
    instance,
  });
  if (conflict) return conflict;
  return noContentResponse({ requestId });
}
