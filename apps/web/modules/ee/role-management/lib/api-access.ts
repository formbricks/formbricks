import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/lib/permission";

export const ROLE_MANAGEMENT_NOT_ALLOWED_DETAIL = "Role management is not allowed for this organization";

/**
 * The role management licence (teams, and changing a member's or invitee's role) as an HTTP answer: `null`
 * to go ahead, or the 403 to answer with. Runs `checkRoleManagementPermission`, the same check the server
 * actions ran, so the entitlement rule stays in one place.
 *
 * Call it only after the caller is authorized, so a non-member never learns whether the organization holds
 * the entitlement. An organization that is gone by then gets the plain 403 a caller gets for one they can't
 * see.
 */
export async function requireRoleManagementEntitlement({
  organizationId,
  requestId,
  instance,
}: {
  organizationId: string;
  requestId: string;
  instance?: string;
}): Promise<Response | null> {
  try {
    await checkRoleManagementPermission(organizationId);
    return null;
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    if (error instanceof OperationNotAllowedError) {
      return problemForbidden(requestId, ROLE_MANAGEMENT_NOT_ALLOWED_DETAIL, instance);
    }
    throw error;
  }
}
