import "server-only";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemBadRequest,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getInvite } from "@/lib/utils/services";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { requireRoleManagementEntitlement } from "@/modules/ee/role-management/lib/api-access";
import { updateInvite } from "@/modules/ee/role-management/lib/invite";
import { getInvite as getInviteAuditSnapshot } from "@/modules/organization/settings/teams/lib/invite";
import type { TInviteUpdateBody } from "../schemas";
import { serializeInviteRole } from "../serializers";

/**
 * `PATCH /api/internal/invites/{inviteId}`: change the role a pending invite grants. The organization is
 * read off the invite. The caller must be a member with `organization.manage`; managers may only invite
 * members, the billing role exists only on Formbricks Cloud, and the role management licence applies.
 * A missing invite gets the same 403 as one in an organization the caller can't see.
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

  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  if (!IS_FORMBRICKS_CLOUD && body.role === "billing") {
    return problemBadRequest(requestId, "Billing role is not allowed", {
      instance,
      invalid_params: [{ name: "role", reason: "Billing role is not allowed" }],
    });
  }

  if (callerMembership.role === "manager" && body.role !== "member") {
    return problemForbidden(requestId, "Managers can only invite members", instance);
  }

  const notEntitled = await requireRoleManagementEntitlement({ organizationId, requestId, instance });
  if (notEntitled) return notEntitled;

  const before = await getInviteAuditSnapshot(inviteId);
  await updateInvite(inviteId, body);
  const after = await getInviteAuditSnapshot(inviteId);

  if (auditLog) {
    auditLog.oldObject = { ...before };
    auditLog.newObject = { ...after };
  }
  return successResponse(serializeInviteRole(inviteId, body.role), { requestId });
}
