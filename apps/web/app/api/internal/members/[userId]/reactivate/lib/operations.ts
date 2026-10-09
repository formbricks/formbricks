import "server-only";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemForbidden, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { requireOrgActionAccess } from "@/modules/ee/data-retention/lib/api-access";
import { reactivateRetentionMember } from "@/modules/ee/data-retention/lib/reactivate-service";

/**
 * Reactivate a member of `organizationId`. User management, so `organization.manage_access` and no data
 * retention licence: a member deactivated while the organisation held one can be brought back after it
 * lapses. The target must be a member of that organisation, and a missing user, a member of another
 * organisation and one of this organisation's non-members get the same 403. Reactivating someone already
 * active changes nothing and isn't audited.
 */
export async function reactivateMemberOperation({
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
  if (auditLog) auditLog.targetId = userId;

  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage_access",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  const result = await reactivateRetentionMember({
    userId,
    organizationId: access.organizationId,
    actorUserId: access.userId,
  });
  switch (result.status) {
    case "not_member":
      return problemForbidden(requestId, undefined, instance);
    case "owner_needs_owner":
      // The caller sees roles on the member list already, so naming the reason reveals nothing new.
      return problemForbidden(requestId, "Only an owner can reactivate an owner.", instance);
    case "in_other_organizations":
      return problemUnprocessableContent(
        requestId,
        "This person also belongs to another organization, so their account can't be reactivated from here.",
        { instance, code: "member_in_other_organizations" }
      );
    case "already_active":
      skipV3AuditLog(auditLog);
      return successResponse({ userId, isActive: true }, { requestId });
    case "reactivated":
      if (auditLog) {
        auditLog.oldObject = { isActive: false };
        auditLog.newObject = { isActive: true, reactivatedAt: result.reactivatedAt.toISOString() };
      }
      return successResponse({ userId, isActive: true }, { requestId });
  }
}
