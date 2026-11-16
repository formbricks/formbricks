import "server-only";
import { ValidationError } from "@formbricks/types/errors";
import type { TMembership } from "@formbricks/types/memberships";
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
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { canManageUsers } from "@/lib/membership/user-management";
import { lockUserActiveState } from "@/lib/user/reactivation";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  refuseRoleAssignment,
  requireRoleManagementEntitlement,
} from "@/modules/ee/role-management/lib/api-access";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { deleteMembership } from "@/modules/organization/settings/teams/lib/membership";
import {
  LastActiveOwnerError,
  runOwnerGuardedTransaction,
} from "@/modules/organization/settings/teams/lib/owner-guard";
import type { TMemberUpdateBody } from "../schemas";
import { serializeMemberRole } from "../serializers";

export const LAST_OWNER_DETAIL = "You cannot demote the last owner of the organization";

/**
 * Change the role, demoting an owner only while another active owner remains, as the member list's server
 * action did (ENG-6767). `runOwnerGuardedTransaction` takes the owners' lock that every last-owner check
 * takes, so of two owners demoting each other at once the second waits, then counts what the first
 * committed, and is refused. The user's row is locked next, as removing a member locks it: a demotion to
 * Dashboard viewer decides whether only viewer memberships remain (and revokes the wider OAuth grants), and
 * must see a removal from another organization that commits at the same moment.
 *
 * Whether this is an owner's demotion is decided from the lookup before the lock, as the action did;
 * deciding it under the lock instead is ENG-2177.
 */
const applyRoleChange = async (
  target: TMembership,
  body: TMemberUpdateBody
): Promise<TMembership | LastActiveOwnerError> => {
  const { userId, organizationId } = target;
  if (target.role !== "owner" || body.role === "owner") {
    return updateMembership(userId, organizationId, body);
  }

  try {
    return await runOwnerGuardedTransaction(organizationId, userId, async (tx) => {
      await lockUserActiveState(tx, userId);
      return updateMembership(userId, organizationId, body, tx);
    });
  } catch (error) {
    if (error instanceof LastActiveOwnerError) return error;
    throw error;
  }
};

/**
 * `PATCH /api/internal/members/{userId}?organizationId=`: change a member's organization role.
 *
 * The caller must be a member with `organization.manage_access` (user management, per
 * `USER_MANAGEMENT_MINIMUM_ROLE`) and `organization.manage`. The role rules are `assertCanAssignRole`'s
 * (managers give only the roles they may and may not touch an owner; billing is Cloud-only; the Dashboard
 * viewer role needs its plan); the last active owner can't be demoted; and the role management licence
 * applies. A missing member gets the same 403 as one in an
 * organization the caller can't see.
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

  const result = await applyRoleChange(target, body);
  if (result instanceof LastActiveOwnerError) {
    return problemConflict(requestId, LAST_OWNER_DETAIL, instance);
  }

  if (auditLog) auditLog.newObject = result;
  return successResponse(serializeMemberRole(result), { requestId });
}

/**
 * Remove a membership, mapping the last-owner guard `deleteMembership` runs under the owners' lock
 * (`runOwnerGuardedTransaction`, where two concurrent removals can't both pass it) to a 409 with its reason.
 */
export async function deleteMembershipOrConflict(
  userId: string,
  organizationId: string,
  { requestId, instance }: { requestId: string; instance?: string }
): Promise<Response | null> {
  try {
    await deleteMembership(userId, organizationId);
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
  const conflict = await deleteMembershipOrConflict(userId, organizationId, { requestId, instance });
  if (conflict) return conflict;
  return noContentResponse({ requestId });
}
