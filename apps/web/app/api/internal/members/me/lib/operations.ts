import "server-only";
import { deleteMembershipOrConflict } from "@/app/api/internal/members/[userId]/lib/operations";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemConflict,
  problemForbidden,
  problemUnauthorized,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getMembershipsByUserId } from "@/modules/organization/settings/teams/lib/membership";

/**
 * `DELETE /api/internal/members/me?organizationId=`: leave the organization. It needs nothing but the
 * caller's own membership: not `organization.read`, which SpiceDB denies a Dashboard viewer (ADR-0025), who
 * must still be able to leave. An owner can't leave, nor can anyone where the licence allows only one
 * organization, nor someone this is the only organization of. Someone who isn't a member gets the uniform
 * 403 before any budget is spent.
 */
export async function leaveOrganizationOperation({
  authentication,
  organizationId,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  if (auditLog) auditLog.organizationId = organizationId;

  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);
  if (auditLog) auditLog.targetId = `${actor.id}-${organizationId}`;

  const membership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
  if (!membership) return problemForbidden(requestId, undefined, instance);

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  if (getAccessFlags(membership.role).isOwner) {
    return problemForbidden(requestId, "You cannot leave an organization you own", instance);
  }

  if (!(await getIsMultiOrgEnabled())) {
    return problemForbidden(
      requestId,
      "You cannot leave the organization because you are the only owner and organization deletion is disabled",
      instance
    );
  }

  const memberships = await getMembershipsByUserId(actor.id);
  if (!memberships || memberships.length <= 1) {
    return problemConflict(requestId, "You cannot leave the only organization you are a member of", instance);
  }

  if (auditLog) auditLog.oldObject = membership;
  const conflict = await deleteMembershipOrConflict(actor.id, organizationId, { requestId, instance });
  if (conflict) return conflict;
  return noContentResponse({ requestId });
}
