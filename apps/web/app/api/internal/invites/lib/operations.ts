import "server-only";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { forbidOnRefusal } from "@/app/api/internal/lib/refusal";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { problemForbidden, problemUnauthorized, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { canManageUsers } from "@/lib/membership/user-management";
import { getInvite } from "@/lib/utils/services";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  refuseRoleAssignment,
  requireRoleManagementEntitlement,
} from "@/modules/ee/role-management/lib/api-access";
import { updateInvite } from "@/modules/ee/role-management/lib/invite";
import { getInvite as getInviteAuditSnapshot } from "@/modules/organization/settings/teams/lib/invite";
import type { TInviteUpdateBody } from "../schemas";
import { serializeInviteRole } from "../serializers";

/**
 * `PATCH /api/internal/invites/{inviteId}`: change the role a pending invite grants. The organization is
 * read off the invite. The caller must be a member above the user-management floor (`canManageUsers`) with
 * `organization.manage`; the role rules are `assertCanAssignRole`'s, as for a member's role; only an owner
 * may change an owner's invite (ENG-6812); and the role management licence applies. A missing invite gets
 * the same 403 as one in an organization the caller can't see.
 */
export async function updateInviteOperation({
  authentication,
  inviteId,
  body,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  inviteId: string;
  body: TInviteUpdateBody;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  if (auditLog) auditLog.targetId = inviteId;

  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  const invite = await getInvite(inviteId);
  if (!invite) return problemForbidden(requestId, undefined, instance);
  const { organizationId } = invite;
  if (auditLog) auditLog.organizationId = organizationId;

  const callerMembership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
  if (!callerMembership) return problemForbidden(requestId, undefined, instance);

  // The user-management floor and `organization.manage` are separate capabilities, both required, as on
  // a member's role. The floor answers first, with its reason: the caller is a member, so naming it
  // reveals nothing.
  const [mayManageUsers, access] = await Promise.all([
    canManageUsers(actor.id, organizationId),
    requireOrgActionAccess({
      authentication,
      organizationId,
      action: "organization.manage",
      requestId,
      instance,
    }),
  ]);
  if (!mayManageUsers) {
    return problemForbidden(requestId, "User management is not allowed for your role", instance);
  }
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  const refused = await refuseRoleAssignment({
    organizationId,
    assignerRole: callerMembership.role,
    role: body.role,
    requestId,
    instance,
  });
  if (refused) return refused;

  const notEntitled = await requireRoleManagementEntitlement({ organizationId, requestId, instance });
  if (notEntitled) return notEntitled;

  const before = await getInviteAuditSnapshot(inviteId);
  // Scoped in the write's own `WHERE`, so an invite promoted to owner after the checks above is not touched
  // either. One deleted since it was read gets the same 403 as a missing invite.
  const writeRefused = await forbidOnRefusal(
    () => updateInvite(inviteId, body, { allowOwnerInvite: callerMembership.role === "owner" }),
    requestId,
    instance
  );
  if (writeRefused) return writeRefused;

  if (auditLog) {
    auditLog.oldObject = { ...before };
    // Built from the write rather than re-read: `getInvite` is request-cached, so a second read here
    // would return the snapshot from before the update.
    auditLog.newObject = { ...before, ...body };
  }
  return successResponse(serializeInviteRole(inviteId, body.role), { requestId });
}
